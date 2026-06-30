from fastapi.testclient import TestClient
import pytest
from sqlalchemy import delete

from app.database import SessionLocal
from app.main import app
from app.models import LoginAttempt


@pytest.fixture()
def client() -> TestClient:
    with SessionLocal() as db:
        db.execute(delete(LoginAttempt))
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
    assert body["items"][0]["detail_path"].startswith("/admin/leads?")
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
