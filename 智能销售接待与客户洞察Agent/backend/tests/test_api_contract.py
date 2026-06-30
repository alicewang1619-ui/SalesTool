from fastapi.testclient import TestClient
import pytest
from sqlalchemy import delete

from app.database import Base, SessionLocal, engine
from app.main import app, ensure_sqlite_compatibility
from app.models import AuditLog, ImportJob, Lead, LoginAttempt, SourceDictionary


@pytest.fixture()
def client() -> TestClient:
    Base.metadata.create_all(bind=engine)
    ensure_sqlite_compatibility()
    with SessionLocal() as db:
        db.execute(delete(LoginAttempt))
        db.execute(delete(ImportJob))
        db.query(Lead).filter(Lead.customer_name.in_(["Clinica Shanghai", "重复客户"])).delete(synchronize_session=False)
        disabled = db.query(SourceDictionary).filter(SourceDictionary.category == "停用来源", SourceDictionary.label == "旧展会").first()
        if not disabled:
            db.add(SourceDictionary(category="停用来源", label="旧展会", enabled=False))
        globalmed = db.query(Lead).filter(Lead.customer_name == "GlobalMed Peru").first()
        if globalmed:
            globalmed.owner_id = 2
            globalmed.feedback_status = "未反馈"
        al_noor = db.query(Lead).filter(Lead.customer_name == "Al Noor Hospital").first()
        if al_noor:
            al_noor.owner_id = None
            al_noor.feedback_status = "需跟进"
        db.commit()
    with TestClient(app) as test_client:
        yield test_client


def auth_headers(
    client: TestClient,
    email: str = "admin@ultrasound-growth.local",
    password: str = "Admin123!",
) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_health_returns_ok(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_login_returns_role_and_token(client: TestClient) -> None:
    response = client.post("/api/auth/login", json={"email": "admin@ultrasound-growth.local", "password": "Admin123!"})
    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "admin"
    assert body["access_token"]
    me = client.get("/api/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert me.json()["email"] == "admin@ultrasound-growth.local"


def test_login_locks_after_repeated_wrong_passwords_and_audits_trace(client: TestClient) -> None:
    headers = auth_headers(client)
    payload = {"email": "unknown@ultrasound-growth.local", "password": "wrong-password"}

    for _ in range(5):
        response = client.post("/api/auth/login", json=payload)
        assert response.status_code == 401
        assert response.json()["detail"]["code"] == "INVALID_CREDENTIALS"
        assert response.headers["x-trace-id"]

    locked = client.post("/api/auth/login", json=payload)
    assert locked.status_code == 429
    assert locked.json()["detail"]["code"] == "LOGIN_LOCKED"
    assert locked.headers["x-trace-id"]

    audit = client.get("/api/audit-logs", headers=headers)
    assert audit.status_code == 200
    events = audit.json()["items"]
    assert any(event["action"] == "login_failed" and event["trace_id"] for event in events)


def test_leads_are_paginated_and_source_filtered(client: TestClient) -> None:
    response = client.get("/api/leads", params={"source_category": "网站", "page_size": 10}, headers=auth_headers(client))
    assert response.status_code == 200
    body = response.json()
    assert body["page"] == 1
    assert body["page_size"] == 10
    assert body["total"] >= 1
    assert all(item["source_category"] == "网站" for item in body["items"])


def test_source_dictionary_drives_leads_filter_options(client: TestClient) -> None:
    headers = auth_headers(client)
    response = client.get("/api/source-dictionary", headers=headers)
    assert response.status_code == 200
    body = response.json()
    categories = {item["category"] for item in body}
    labels = {item["label"] for item in body}
    leads = client.get("/api/leads", params={"page_size": 20}, headers=headers).json()["items"]

    assert len(categories) >= 5
    assert "官网邮箱" in labels
    assert {item["source_category"] for item in leads} <= categories


def test_lead_detail_returns_same_record_and_respects_sales_scope(client: TestClient) -> None:
    admin_headers = auth_headers(client)
    list_response = client.get("/api/leads", params={"page_size": 10}, headers=admin_headers)
    assert list_response.status_code == 200
    target = next(item for item in list_response.json()["items"] if item["customer_name"] == "GlobalMed Peru")

    detail_response = client.get(f"/api/leads/{target['id']}", headers=admin_headers)
    assert detail_response.status_code == 200
    assert detail_response.json()["id"] == target["id"]
    assert detail_response.json()["customer_name"] == target["customer_name"]

    sales_headers = auth_headers(client, "maria@ultrasound-growth.local", "Sales123!")
    assert client.get(f"/api/leads/{target['id']}", headers=sales_headers).status_code == 200
    forbidden = next(item for item in list_response.json()["items"] if item["customer_name"] == "Al Noor Hospital")
    assert client.get(f"/api/leads/{forbidden['id']}", headers=sales_headers).status_code == 403


def test_lead_detail_returns_full_context_for_manual_judgement(client: TestClient) -> None:
    headers = auth_headers(client)
    target = next(
        item
        for item in client.get("/api/leads", params={"page_size": 10}, headers=headers).json()["items"]
        if item["customer_name"] == "GlobalMed Peru"
    )

    response = client.get(f"/api/leads/{target['id']}", headers=headers)
    assert response.status_code == 200
    body = response.json()

    assert body["raw_inquiry"] == "客户原文：We distribute imaging devices in Peru and need a portable ultrasound portfolio for regional clinics."
    assert body["conversation_history"] == [
        "客户询问 portable ultrasound 代理组合与区域诊所应用。",
        "AI 追问国家、客户身份和应用场景后确认其为 Peru 代理商。",
        "客户表示希望三天内收到产品对比资料。"
    ]
    assert body["profile_summary"]["customer_type"] == body["customer_type"]
    assert body["score_reasons"]
    assert body["background_summary"]
    assert body["assignment"]["status"] in {"未反馈", "需跟进", "已联系", "已报价", "未分发"}
    assert body["feedback_history"]


def test_lead_assignment_update_persists_and_writes_audit(client: TestClient) -> None:
    headers = auth_headers(client)
    target = next(
        item
        for item in client.get("/api/leads", params={"page_size": 10}, headers=headers).json()["items"]
        if item["customer_name"] == "Al Noor Hospital"
    )

    response = client.put(
        f"/api/leads/{target['id']}/assignment",
        json={"owner_id": 2, "feedback_status": "未反馈"},
        headers={**headers, "x-trace-id": "lead-assignment-test"},
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["assignment"]["owner_id"] == 2
    assert updated["assignment"]["owner_name"] == "Maria Chen"
    assert updated["assignment"]["status"] == "未反馈"

    refreshed = client.get(f"/api/leads/{target['id']}", headers=headers)
    assert refreshed.status_code == 200
    assert refreshed.json()["assignment"]["owner_id"] == 2

    audit = client.get("/api/audit-logs", headers=headers)
    assert audit.status_code == 200
    assert any(
        event["action"] == "lead_assignment_updated"
        and event["target_id"] == target["id"]
        and event["trace_id"] == "lead-assignment-test"
        for event in audit.json()["items"]
    )
    with SessionLocal() as db:
        lead = db.get(Lead, target["id"])
        assert lead is not None
        lead.owner_id = None
        lead.feedback_status = "需跟进"
        db.commit()


def test_sales_user_only_sees_owned_leads(client: TestClient) -> None:
    response = client.get("/api/leads", headers=auth_headers(client, "maria@ultrasound-growth.local", "Sales123!"))
    assert response.status_code == 200
    names = [item["customer_name"] for item in response.json()["items"]]
    assert "GlobalMed Peru" in names
    assert "Al Noor Hospital" not in names


def test_dashboard_requires_login(client: TestClient) -> None:
    response = client.get("/api/dashboard")
    assert response.status_code == 401


def test_dashboard_returns_backend_aggregates_and_paginated_todos(client: TestClient) -> None:
    response = client.get("/api/dashboard", params={"page_size": 1}, headers=auth_headers(client))
    assert response.status_code == 200
    body = response.json()

    assert body["page"] == 1
    assert body["page_size"] == 1
    assert body["total"] >= 2
    assert len(body["items"]) == 1
    assert {"today_inquiries", "valid_leads", "unfeedback", "website_kpi"} <= set(body["metrics"])
    assert body["metrics"]["today_inquiries"] >= body["total"]
    assert 0 <= body["metrics"]["website_kpi"] <= 100
    assert body["items"][0]["id"]
    assert body["items"][0]["detail_path"].startswith("/admin/leads/")
    assert str(body["items"][0]["id"]) in body["items"][0]["detail_path"]


def test_dashboard_filters_and_pagination_are_backend_driven(client: TestClient) -> None:
    headers = auth_headers(client)
    seed_rows = client.get("/api/leads", params={"page_size": 10}, headers=headers).json()["items"]
    target = next(item for item in seed_rows if item["customer_name"] == "Al Noor Hospital")

    filtered = client.get(
        "/api/dashboard",
        params={
            "source_category": target["source_category"],
            "country": target["country"],
            "customer_type": target["customer_type"],
            "product": target["product"],
            "page_size": 10,
        },
        headers=headers,
    )
    assert filtered.status_code == 200
    filtered_body = filtered.json()
    assert filtered_body["total"] == 1
    assert filtered_body["items"][0]["customer_name"] == "Al Noor Hospital"
    assert all(item["source_category"] == target["source_category"] for item in filtered_body["items"])

    first_page = client.get("/api/dashboard", params={"page": 1, "page_size": 1}, headers=headers)
    second_page = client.get("/api/dashboard", params={"page": 2, "page_size": 1}, headers=headers)
    assert first_page.status_code == 200
    assert second_page.status_code == 200
    assert first_page.json()["items"][0]["id"] != second_page.json()["items"][0]["id"]


def test_dashboard_respects_sales_data_scope(client: TestClient) -> None:
    response = client.get(
        "/api/dashboard",
        headers=auth_headers(client, "maria@ultrasound-growth.local", "Sales123!"),
    )
    assert response.status_code == 200
    names = [item["customer_name"] for item in response.json()["items"]]
    assert "GlobalMed Peru" in names
    assert "Al Noor Hospital" not in names


def test_dashboard_view_is_audited_with_trace_id(client: TestClient) -> None:
    headers = auth_headers(client)
    response = client.get("/api/dashboard", headers=headers)
    assert response.status_code == 200

    audit = client.get("/api/audit-logs", headers=headers)
    assert audit.status_code == 200
    events = audit.json()["items"]
    assert any(event["action"] == "dashboard_viewed" and event["trace_id"] for event in events)


def test_customer_background_can_be_manually_updated_by_admin(client: TestClient) -> None:
    headers = auth_headers(client)
    response = client.put(
        "/api/customers/1/background",
        json={"manual_summary": "人工修订：GlobalMed Peru 需要在三天后进行便携式超声方案跟进。"},
        headers=headers,
    )
    assert response.status_code == 200
    background = response.json()["background"]
    assert background["manual_summary"].startswith("人工修订")
    assert background["updated_by"] == "Alice Admin"


def test_sales_user_cannot_update_customer_background(client: TestClient) -> None:
    response = client.put(
        "/api/customers/1/background",
        json={"manual_summary": "销售尝试越权修改客户背景调查，应被拒绝。"},
        headers=auth_headers(client, "maria@ultrasound-growth.local", "Sales123!"),
    )
    assert response.status_code == 403


def test_channel_import_uploads_csv_to_task_and_persists_success_rows(client: TestClient) -> None:
    headers = auth_headers(client)
    csv_body = "\n".join(
        [
            "customer_name,country,customer_type,product,source_category,source_label",
            "Clinica Shanghai,China,Clinic,Portable Ultrasound,网站,官网聊天",
            "重复客户,Peru,代理商,Handheld Ultrasound,网站,官网聊天",
            "重复客户,Peru,代理商,Handheld Ultrasound,网站,官网聊天",
            "缺国家,,Hospital,Trolley Ultrasound,邮箱,官网邮箱",
            "停用来源客户,China,Clinic,Portable Ultrasound,停用来源,旧展会",
        ]
    )

    response = client.post(
        "/api/import-jobs",
        files={"file": ("leads.csv", csv_body.encode("utf-8"), "text/csv")},
        headers={**headers, "x-trace-id": "import-success-test"},
    )

    assert response.status_code == 201
    created = response.json()
    assert created["task_id"]
    assert created["filename"] == "leads.csv"
    assert created["status"] in {"queued", "processing", "completed"}

    job = client.get(f"/api/import-jobs/{created['task_id']}", headers=headers)
    assert job.status_code == 200
    body = job.json()
    assert body["status"] == "completed"
    assert body["total_rows"] == 5
    assert body["success_rows"] == 2
    assert body["failed_rows"] == 3
    assert any(item["reason"] == "DUPLICATE_CUSTOMER" and item["customer_name"] == "重复客户" for item in body["failures"])
    assert any(item["reason"] == "MISSING_COUNTRY" and item["row_number"] == 4 for item in body["failures"])
    assert any(item["reason"] == "SOURCE_DISABLED" and item["customer_name"] == "停用来源客户" for item in body["failures"])

    leads = client.get("/api/leads", params={"page_size": 100}, headers=headers)
    names = {item["customer_name"] for item in leads.json()["items"]}
    assert {"Clinica Shanghai", "重复客户"} <= names

    audit = client.get("/api/audit-logs", headers=headers)
    assert any(event["action"] == "import_job_completed" and event["trace_id"] == "import-success-test" for event in audit.json()["items"])


def test_channel_import_rejects_oversized_or_invalid_files_before_worker(client: TestClient) -> None:
    headers = auth_headers(client)
    response = client.post(
        "/api/import-jobs",
        files={"file": ("leads.exe", b"not,a,csv", "application/octet-stream")},
        headers={**headers, "x-trace-id": "import-rejected-test"},
    )

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "INVALID_IMPORT_FILE"

    audit = client.get("/api/audit-logs", headers=headers)
    assert any(event["action"] == "import_rejected" and event["trace_id"] == "import-rejected-test" for event in audit.json()["items"])


def test_channel_import_failure_rows_are_downloadable_and_retry_is_idempotent(client: TestClient) -> None:
    headers = auth_headers(client)
    csv_body = "\n".join(
        [
            "customer_name,country,customer_type,product,source_category,source_label",
            "无国家医院,,Hospital,Trolley Ultrasound,邮箱,官网邮箱",
        ]
    )
    created = client.post(
        "/api/import-jobs",
        files={"file": ("failed_rows.csv", csv_body.encode("utf-8"), "text/csv")},
        headers=headers,
    ).json()

    download = client.get(f"/api/import-jobs/{created['task_id']}/failed-rows", headers=headers)
    assert download.status_code == 200
    assert "无国家医院" in download.text
    assert "MISSING_COUNTRY" in download.text

    retry = client.post(f"/api/import-jobs/{created['task_id']}/retry", headers=headers)
    assert retry.status_code == 200
    assert retry.json()["task_id"] == created["task_id"]
    assert retry.json()["status"] == "completed"
    assert retry.json()["failed_rows"] == 1
