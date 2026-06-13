"""Backend tests for:
1) Customers PUT partial update (exclude_unset) — inline editing
2) Automated Database Backup endpoints (admin-only)
"""
import os
import json
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://button-consolidation.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin.test@crmaster.local"
ADMIN_PASSWORD = "Admin1234"


# ---------------- fixtures ----------------

@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["session_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"X-Session-Token": admin_token, "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def test_customer(admin_headers):
    """Create one test customer for inline-edit checks; cleanup at session end."""
    payload = {
        "company_name": f"TEST_InlineEdit_{uuid.uuid4().hex[:6]}",
        "market": "Endüstri",
        "application": "Test App",
        "city": "İstanbul",
        "district": "Kadıköy",
        "status": "Beklemede",
        "contact_info": {"contact_person": "Tester", "email": "t@t.com", "phone": "5550000"},
        "is_followup": False,
    }
    r = requests.post(f"{API}/customers", json=payload, headers=admin_headers, timeout=20)
    assert r.status_code in (200, 201), f"Create customer failed: {r.status_code} {r.text}"
    data = r.json()
    cust_id = data.get("id")
    assert cust_id
    yield data
    try:
        requests.delete(f"{API}/customers/{cust_id}", headers=admin_headers, timeout=15)
    except Exception:
        pass


# ---------------- 1) Customers partial PUT ----------------

class TestCustomerPartialUpdate:
    def test_partial_update_only_company_name(self, admin_headers, test_customer):
        cid = test_customer["id"]
        original_city = test_customer.get("city")
        original_market = test_customer.get("market")
        original_status = test_customer.get("status")

        new_name = f"TEST_Renamed_{uuid.uuid4().hex[:6]}"
        r = requests.put(f"{API}/customers/{cid}", json={"company_name": new_name},
                         headers=admin_headers, timeout=20)
        assert r.status_code == 200, f"PUT failed: {r.status_code} {r.text}"
        updated = r.json()
        # Validate inline-edit save did not wipe other fields
        assert updated["company_name"] == new_name
        assert updated.get("city") == original_city, f"City wiped! got={updated.get('city')!r}"
        assert updated.get("market") == original_market, f"Market wiped!"
        assert updated.get("status") == original_status, f"Status wiped!"

        # GET to verify persistence
        g = requests.get(f"{API}/customers/{cid}", headers=admin_headers, timeout=20)
        assert g.status_code == 200
        fetched = g.json()
        assert fetched["company_name"] == new_name
        assert fetched.get("city") == original_city
        assert fetched.get("market") == original_market

    def test_partial_update_status_only(self, admin_headers, test_customer):
        cid = test_customer["id"]
        original_city = test_customer.get("city")
        r = requests.put(f"{API}/customers/{cid}", json={"status": "İletişimde"},
                         headers=admin_headers, timeout=20)
        assert r.status_code == 200
        updated = r.json()
        assert updated["status"] == "İletişimde"
        assert updated.get("city") == original_city


# ---------------- 2) Backup endpoints ----------------

class TestBackupConfigAndOps:
    def test_get_backup_config_admin(self, admin_headers):
        r = requests.get(f"{API}/backups/config", headers=admin_headers, timeout=15)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        cfg = r.json()
        for k in ("enabled", "frequency", "hour", "minute", "day_of_week",
                  "email_enabled", "email_recipients", "retention_days"):
            assert k in cfg, f"missing key {k} in config"
        assert cfg["frequency"] in ("daily", "weekly")
        assert 0 <= int(cfg["hour"]) <= 23
        assert 0 <= int(cfg["minute"]) <= 59

    def test_get_backup_config_unauth(self):
        r = requests.get(f"{API}/backups/config", timeout=15)
        # No auth -> should NOT be 200
        assert r.status_code in (401, 403), f"Unauth got {r.status_code}"

    def test_put_backup_config_valid(self, admin_headers):
        body = {
            "enabled": False,
            "frequency": "weekly",
            "hour": 3,
            "minute": 15,
            "day_of_week": "tue",
            "email_enabled": False,
            "email_recipients": [],
            "retention_days": 7,
        }
        r = requests.put(f"{API}/backups/config", json=body, headers=admin_headers, timeout=15)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        cfg = r.json()
        assert cfg["frequency"] == "weekly"
        assert cfg["hour"] == 3
        assert cfg["minute"] == 15
        assert cfg["day_of_week"] == "tue"
        assert cfg["retention_days"] == 7

        # GET verifies persistence
        g = requests.get(f"{API}/backups/config", headers=admin_headers, timeout=15)
        assert g.status_code == 200
        gc = g.json()
        assert gc["frequency"] == "weekly"
        assert gc["retention_days"] == 7

    def test_put_backup_config_invalid_frequency(self, admin_headers):
        r = requests.put(f"{API}/backups/config", json={"frequency": "hourly"},
                         headers=admin_headers, timeout=15)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"

    def test_put_backup_config_invalid_hour(self, admin_headers):
        r = requests.put(f"{API}/backups/config", json={"hour": 25},
                         headers=admin_headers, timeout=15)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"

    def test_put_backup_config_invalid_minute(self, admin_headers):
        r = requests.put(f"{API}/backups/config", json={"minute": 99},
                         headers=admin_headers, timeout=15)
        assert r.status_code == 400

    def test_put_backup_config_invalid_dow(self, admin_headers):
        r = requests.put(f"{API}/backups/config", json={"day_of_week": "xyz"},
                         headers=admin_headers, timeout=15)
        assert r.status_code == 400

    def test_trigger_backup(self, admin_headers):
        t0 = time.time()
        r = requests.post(f"{API}/backups/trigger", headers=admin_headers, timeout=60)
        elapsed = time.time() - t0
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        body = r.json()
        assert body.get("ok") is True, f"backup not ok: {body}"
        assert body.get("filename", "").startswith("crm_backup_") and body["filename"].endswith(".json")
        assert body.get("size_bytes", 0) > 100
        # NOTE: This is informational - shouldn't break test if slow on first run
        assert elapsed < 60, f"Backup too slow: {elapsed:.1f}s"
        # store filename for later tests via env (not pytest-clean but OK for local run)
        os.environ["_LAST_BACKUP_FILE"] = body["filename"]

    def test_list_backups_includes_recent(self, admin_headers):
        r = requests.get(f"{API}/backups/list", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "backups" in body
        assert isinstance(body["backups"], list)
        assert len(body["backups"]) >= 1
        last = os.environ.get("_LAST_BACKUP_FILE")
        if last:
            names = [b["filename"] for b in body["backups"]]
            assert last in names, f"recent backup {last} not in list"
        b0 = body["backups"][0]
        for k in ("filename", "size_bytes", "created_at"):
            assert k in b0

    def test_download_backup(self, admin_headers):
        last = os.environ.get("_LAST_BACKUP_FILE")
        if not last:
            pytest.skip("no recent backup filename")
        r = requests.get(f"{API}/backups/{last}/download", headers=admin_headers, timeout=30)
        assert r.status_code == 200, f"{r.status_code}"
        # Content-Disposition should reference filename
        cd = r.headers.get("content-disposition", "")
        assert last in cd or "attachment" in cd.lower(), f"bad CD: {cd}"
        # JSON parse
        data = json.loads(r.content.decode("utf-8"))
        assert "export_date" in data
        assert "customers" in data

    def test_path_traversal_download(self, admin_headers):
        # path traversal must NOT return a file
        for evil in ("..%2Fetc%2Fpasswd", "..%2F..%2Fetc%2Fpasswd"):
            r = requests.get(f"{API}/backups/{evil}/download", headers=admin_headers, timeout=10)
            assert r.status_code in (400, 404, 422), f"traversal not blocked ({evil}): {r.status_code}"

    def test_path_traversal_delete(self, admin_headers):
        for evil in ("..%2Fetc%2Fpasswd",):
            r = requests.delete(f"{API}/backups/{evil}", headers=admin_headers, timeout=10)
            assert r.status_code in (400, 404, 422), f"traversal not blocked ({evil}): {r.status_code}"

    def test_delete_backup_nonexistent(self, admin_headers):
        r = requests.delete(f"{API}/backups/crm_backup_doesnotexist_20990101.json",
                            headers=admin_headers, timeout=10)
        assert r.status_code == 404

    def test_delete_backup_success(self, admin_headers):
        # Trigger one new file to delete (so we don't lose the listed one)
        r = requests.post(f"{API}/backups/trigger", headers=admin_headers, timeout=60)
        assert r.status_code == 200
        fname = r.json()["filename"]
        d = requests.delete(f"{API}/backups/{fname}", headers=admin_headers, timeout=10)
        assert d.status_code == 200, f"{d.status_code} {d.text}"
        assert d.json().get("ok") is True
        # verify it's gone
        g = requests.get(f"{API}/backups/{fname}/download", headers=admin_headers, timeout=10)
        assert g.status_code == 404


class TestBackupUnauth:
    """All /api/backups/* endpoints should reject non-admin (and no auth)."""

    @pytest.mark.parametrize("method,path", [
        ("GET", "/backups/config"),
        ("PUT", "/backups/config"),
        ("GET", "/backups/list"),
        ("POST", "/backups/trigger"),
        ("GET", "/backups/somefile.json/download"),
        ("DELETE", "/backups/somefile.json"),
    ])
    def test_no_auth_blocked(self, method, path):
        url = f"{API}{path}"
        if method == "GET":
            r = requests.get(url, timeout=10)
        elif method == "PUT":
            r = requests.put(url, json={}, timeout=10)
        elif method == "POST":
            r = requests.post(url, timeout=10)
        else:
            r = requests.delete(url, timeout=10)
        assert r.status_code in (401, 403), f"{method} {path} not blocked: {r.status_code}"
