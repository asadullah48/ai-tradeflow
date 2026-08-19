def test_create_and_get_party(client, auth_headers):
    resp = client.post("/parties", json={"name": "Karachi Traders", "name_ur": "کراچی ٹریڈرز", "type": "supplier"}, headers=auth_headers)
    assert resp.status_code == 201
    party_id = resp.json()["id"]

    resp = client.get(f"/parties/{party_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Karachi Traders"


def test_search_party_by_urdu_name(client, auth_headers):
    client.post("/parties", json={"name": "Lahore Store", "name_ur": "لاہور اسٹور", "type": "customer"}, headers=auth_headers)
    resp = client.get("/parties?q=لاہور", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_update_party(client, auth_headers):
    party = client.post("/parties", json={"name": "Original Name", "type": "customer"}, headers=auth_headers).json()
    resp = client.patch(f"/parties/{party['id']}", json={"name": "Updated Name"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Name"


def test_delete_party(client, auth_headers):
    party = client.post("/parties", json={"name": "To Delete", "type": "customer"}, headers=auth_headers).json()
    resp = client.delete(f"/parties/{party['id']}", headers=auth_headers)
    assert resp.status_code == 204
    resp = client.get(f"/parties/{party['id']}", headers=auth_headers)
    assert resp.status_code == 404


def test_party_not_found(client, auth_headers):
    resp = client.get("/parties/does-not-exist", headers=auth_headers)
    assert resp.status_code == 404


def test_create_product(client, auth_headers):
    resp = client.post(
        "/products",
        json={"sku": "PRD-001", "name": "Rice Bag 50kg", "name_ur": "چاول کا تھیلا", "unit": "kg", "cost_price": 8000, "sale_price": 8800},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["current_stock"] == 0


def test_duplicate_sku_rejected(client, auth_headers):
    client.post("/products", json={"sku": "DUP-1", "name": "First"}, headers=auth_headers)
    resp = client.post("/products", json={"sku": "DUP-1", "name": "Second"}, headers=auth_headers)
    assert resp.status_code == 400


def test_recompute_stock_endpoint(client, auth_headers):
    product = client.post("/products", json={"sku": "RECOMP-1", "name": "Recompute Widget"}, headers=auth_headers).json()
    resp = client.post(f"/products/{product['id']}/recompute-stock", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["current_stock"] == 0
