from fastapi.testclient import TestClient
import pytest

from app.main import app


@pytest.fixture()
def client() -> TestClient:
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
