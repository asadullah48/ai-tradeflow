def test_register_creates_user(client):
    resp = client.post("/auth/register", json={"name": "Ali", "phone": "03001111111", "password": "secretpass", "role": "owner"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["phone"] == "03001111111"
    assert "password" not in body
    assert "password_hash" not in body


def test_register_duplicate_phone_fails(client):
    client.post("/auth/register", json={"name": "Ali", "phone": "03002222222", "password": "secretpass", "role": "owner"})
    resp = client.post("/auth/register", json={"name": "Ali Again", "phone": "03002222222", "password": "otherpass", "role": "owner"})
    assert resp.status_code == 400


def test_login_with_correct_credentials(client):
    client.post("/auth/register", json={"name": "Ali", "phone": "03003333333", "password": "secretpass", "role": "owner"})
    resp = client.post("/auth/login", json={"phone": "03003333333", "password": "secretpass"})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_login_with_wrong_password_fails(client):
    client.post("/auth/register", json={"name": "Ali", "phone": "03004444444", "password": "secretpass", "role": "owner"})
    resp = client.post("/auth/login", json={"phone": "03004444444", "password": "wrongpass"})
    assert resp.status_code == 401


def test_protected_route_requires_token(client):
    resp = client.get("/parties")
    assert resp.status_code == 401


def test_protected_route_with_valid_token(client, auth_headers):
    resp = client.get("/parties", headers=auth_headers)
    assert resp.status_code == 200
