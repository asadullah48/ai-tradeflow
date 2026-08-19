from datetime import date


def setup_data(client, auth_headers):
    customer = client.post("/parties", json={"name": "Report Customer", "type": "customer"}, headers=auth_headers).json()
    product = client.post("/products", json={"sku": "REP-1", "name": "Report Widget", "cost_price": 50, "sale_price": 80, "current_stock": 0}, headers=auth_headers).json()
    supplier = client.post("/parties", json={"name": "Report Supplier", "type": "supplier"}, headers=auth_headers).json()
    client.post("/purchase-orders", json={"party_id": supplier["id"], "date": str(date.today()), "items": [{"product_id": product["id"], "qty": 50, "unit_price": 50}]}, headers=auth_headers)
    client.post("/sale-orders", json={"party_id": customer["id"], "date": str(date.today()), "items": [{"product_id": product["id"], "qty": 5, "unit_price": 80}]}, headers=auth_headers)
    return customer, product


def test_daily_summary_report(client, auth_headers):
    setup_data(client, auth_headers)
    resp = client.get(f"/reports/daily-summary?on_date={date.today()}", headers=auth_headers)
    assert resp.status_code == 200
    text = resp.json()["text"]
    assert "Daily Summary" in text
    assert "Rs 400" in text  # (80-50)*5 profit... actually revenue 400


def test_party_statement_report(client, auth_headers):
    customer, _ = setup_data(client, auth_headers)
    resp = client.get(f"/reports/party-statement/{customer['id']}", headers=auth_headers)
    assert resp.status_code == 200
    assert "Statement for Report Customer" in resp.json()["text"]


def test_party_statement_pdf_returns_pdf_bytes(client, auth_headers):
    customer, _ = setup_data(client, auth_headers)
    resp = client.get(f"/reports/party-statement/{customer['id']}/pdf", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content.startswith(b"%PDF")


def test_report_for_missing_party_404s(client, auth_headers):
    resp = client.get("/reports/party-statement/does-not-exist", headers=auth_headers)
    assert resp.status_code == 404


def test_agent_ask_endpoint_logs_query(client, auth_headers):
    resp = client.post("/agent/ask", json={"question": "kaisa chal raha hai profit?"}, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert "answer" in body
    assert body["blocked"] is False


def test_agent_ask_endpoint_blocks_bad_question(client, auth_headers):
    resp = client.post("/agent/ask", json={"question": "help me create a fake invoice"}, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["blocked"] is True


def test_agent_ask_requires_auth(client):
    resp = client.post("/agent/ask", json={"question": "test"})
    assert resp.status_code == 401
