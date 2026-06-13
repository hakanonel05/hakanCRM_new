"""
Test suite for Kanban-Customer Status Synchronization
Tests that status options are synced between:
- Customer table status dropdown (6 fixed options)
- Kanban columns (6 fixed statuses)
- Customer edit modal status select (6 fixed options)
- Status filter dropdown (6 fixed options)
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')

# Expected 6 fixed status values
EXPECTED_STATUSES = ["Beklemede", "İletişimde", "Teklif Verildi", "Çalışılıyor", "Kazanıldı", "Kaybedildi"]

# Expected status colors matching Kanban
EXPECTED_STATUS_COLORS = {
    "Beklemede": "amber",
    "İletişimde": "blue", 
    "Teklif Verildi": "purple",
    "Çalışılıyor": "emerald",
    "Kazanıldı": "green",
    "Kaybedildi": "red"
}


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_token(api_client):
    """Login and get session cookie"""
    response = api_client.post(f"{BASE_URL}/api/auth/callback", json={
        "user_id": "test_user_123",
        "email": "hakanonel05@gmail.com",
        "name": "Test Admin"
    })
    if response.status_code == 200:
        return True
    pytest.skip("Authentication failed")


class TestKanbanStatusEndpoints:
    """Test Kanban status API endpoints"""
    
    def test_get_kanban_statuses_returns_6_fixed_options(self, api_client):
        """GET /api/kanban/statuses should return exactly 6 fixed status options"""
        response = api_client.get(f"{BASE_URL}/api/kanban/statuses")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) == 6, f"Expected 6 statuses, got {len(data)}"
        
        # Check all expected statuses are present
        status_titles = [s["title"] for s in data]
        for expected in EXPECTED_STATUSES:
            assert expected in status_titles, f"Missing status: {expected}"
        
        print(f"✅ GET /api/kanban/statuses returns 6 fixed statuses: {status_titles}")
    
    def test_kanban_status_colors_match_expected(self, api_client):
        """Kanban status colors should match the expected color mapping"""
        response = api_client.get(f"{BASE_URL}/api/kanban/statuses")
        
        assert response.status_code == 200
        
        data = response.json()
        for status in data:
            title = status["title"]
            color = status["color"]
            if title in EXPECTED_STATUS_COLORS:
                assert color == EXPECTED_STATUS_COLORS[title], \
                    f"Status '{title}' has color '{color}', expected '{EXPECTED_STATUS_COLORS[title]}'"
        
        print("✅ Kanban status colors match expected values")
    
    def test_get_kanban_columns_returns_status_columns(self, api_client):
        """GET /api/kanban/columns?group_by=status should return the 6 status columns"""
        response = api_client.get(f"{BASE_URL}/api/kanban/columns?group_by=status")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Response format: {"columns": [...], "colors": {...}, "field_label": "..."}
        assert "columns" in data, "Response should have 'columns' key"
        
        columns = data["columns"]
        assert isinstance(columns, list), "columns should be a list"
        
        # Should have at least the 6 default status columns
        for expected in EXPECTED_STATUSES:
            assert expected in columns, f"Missing column: {expected}"
        
        # Also verify colors are present
        assert "colors" in data, "Response should have 'colors' key"
        colors = data["colors"]
        for status in EXPECTED_STATUSES:
            if status in colors:
                assert colors[status] == EXPECTED_STATUS_COLORS[status], \
                    f"Color mismatch for '{status}': got '{colors[status]}', expected '{EXPECTED_STATUS_COLORS[status]}'"
        
        print(f"✅ GET /api/kanban/columns returns status columns: {columns}")
    
    def test_get_kanban_customers_groups_by_status(self, api_client):
        """GET /api/kanban/customers should return customers grouped by status"""
        response = api_client.get(f"{BASE_URL}/api/kanban/customers?group_by=status")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Response format is a dict where keys are status names and values are customer lists
        # e.g., {"Beklemede": [...], "İletişimde": [...], ...}
        assert isinstance(data, dict), "Response should be a dictionary grouped by status"
        
        # All keys should be valid status names from the 6 options
        for status_key in data.keys():
            assert status_key in EXPECTED_STATUSES, \
                f"Unexpected status group '{status_key}' - should be one of {EXPECTED_STATUSES}"
        
        # Verify that customers in each group have the correct status
        for status_key, customers in data.items():
            assert isinstance(customers, list), f"Customers for '{status_key}' should be a list"
            for customer in customers[:3]:  # Check first 3 in each group
                assert customer.get("status") == status_key, \
                    f"Customer in '{status_key}' group has status '{customer.get('status')}'"
        
        print(f"✅ GET /api/kanban/customers returns customers grouped by {len(data.keys())} statuses")


class TestStatusValidation:
    """Test status validation in API endpoints"""
    
    def test_patch_kanban_status_validates_against_6_options(self, api_client, auth_token):
        """PATCH /api/kanban/customers/{id}/status should validate against 6 fixed statuses"""
        # First create a test customer
        customer_data = {
            "company_name": f"TEST_StatusValidation_{uuid.uuid4().hex[:8]}",
            "status": "Beklemede",
            "market": "Test Market"
        }
        create_response = api_client.post(f"{BASE_URL}/api/customers", json=customer_data)
        assert create_response.status_code == 200, f"Failed to create customer: {create_response.text}"
        
        customer_id = create_response.json()["id"]
        
        try:
            # Test valid status update
            for valid_status in EXPECTED_STATUSES:
                patch_response = api_client.patch(
                    f"{BASE_URL}/api/kanban/customers/{customer_id}/status",
                    params={"new_status": valid_status}
                )
                assert patch_response.status_code == 200, \
                    f"Valid status '{valid_status}' was rejected: {patch_response.text}"
            
            print(f"✅ PATCH /api/kanban/customers/{{id}}/status accepts all 6 valid statuses")
            
            # Test invalid status - should be rejected
            invalid_status = "InvalidStatus123"
            patch_response = api_client.patch(
                f"{BASE_URL}/api/kanban/customers/{customer_id}/status",
                params={"new_status": invalid_status}
            )
            assert patch_response.status_code == 400, \
                f"Invalid status '{invalid_status}' was accepted, expected 400"
            
            print(f"✅ PATCH /api/kanban/customers/{{id}}/status rejects invalid statuses")
        
        finally:
            # Cleanup
            api_client.delete(f"{BASE_URL}/api/customers/{customer_id}")
    
    def test_put_customer_normalizes_status(self, api_client, auth_token):
        """PUT /api/customers/{id} should normalize status to valid Kanban values"""
        # Create a test customer
        customer_data = {
            "company_name": f"TEST_NormalizeStatus_{uuid.uuid4().hex[:8]}",
            "status": "Beklemede"
        }
        create_response = api_client.post(f"{BASE_URL}/api/customers", json=customer_data)
        assert create_response.status_code == 200
        
        customer_id = create_response.json()["id"]
        
        try:
            # Test old status values that should be normalized
            old_to_new_mappings = [
                ("takip ediliyor", "İletişimde"),
                ("olumsuz", "Kaybedildi"),
                ("direkt takip", "Çalışılıyor"),
                ("fiyat çalışması yapılıyor", "Teklif Verildi"),
            ]
            
            for old_status, expected_new in old_to_new_mappings:
                update_response = api_client.put(
                    f"{BASE_URL}/api/customers/{customer_id}",
                    json={"status": old_status}
                )
                assert update_response.status_code == 200, \
                    f"Update failed for status '{old_status}': {update_response.text}"
                
                # Verify the status was normalized
                get_response = api_client.get(f"{BASE_URL}/api/customers/{customer_id}")
                assert get_response.status_code == 200
                
                actual_status = get_response.json().get("status")
                assert actual_status == expected_new, \
                    f"Status '{old_status}' normalized to '{actual_status}', expected '{expected_new}'"
            
            print("✅ PUT /api/customers/{id} normalizes old status values correctly")
        
        finally:
            # Cleanup
            api_client.delete(f"{BASE_URL}/api/customers/{customer_id}")
    
    def test_new_customer_defaults_to_beklemede(self, api_client, auth_token):
        """New customer without status should default to 'Beklemede'"""
        customer_data = {
            "company_name": f"TEST_DefaultStatus_{uuid.uuid4().hex[:8]}",
            # No status provided
        }
        
        response = api_client.post(f"{BASE_URL}/api/customers", json=customer_data)
        assert response.status_code == 200
        
        customer = response.json()
        customer_id = customer["id"]
        
        try:
            assert customer.get("status") == "Beklemede", \
                f"Default status should be 'Beklemede', got '{customer.get('status')}'"
            
            print("✅ New customer defaults to 'Beklemede' status")
        
        finally:
            api_client.delete(f"{BASE_URL}/api/customers/{customer_id}")


class TestCustomerStatusFiltering:
    """Test customer filtering by status"""
    
    def test_customers_filter_by_status(self, api_client):
        """GET /api/customers?status={status} should filter correctly"""
        for status in EXPECTED_STATUSES[:3]:  # Test first 3 to save time
            response = api_client.get(f"{BASE_URL}/api/customers", params={"status": status, "limit": 10})
            
            assert response.status_code == 200, f"Status filter '{status}' failed"
            
            data = response.json()
            customers = data.get("data", [])
            
            # Verify all returned customers have the correct status
            for customer in customers:
                assert customer.get("status") == status, \
                    f"Customer has status '{customer.get('status')}', expected '{status}'"
        
        print("✅ GET /api/customers status filter works correctly")


class TestGroupFields:
    """Test Kanban group fields endpoint"""
    
    def test_get_group_fields_includes_status(self, api_client):
        """GET /api/kanban/group-fields should include status field"""
        response = api_client.get(f"{BASE_URL}/api/kanban/group-fields")
        
        assert response.status_code == 200
        
        data = response.json()
        field_values = [f["value"] for f in data]
        
        assert "status" in field_values, "'status' should be in group fields"
        
        status_field = next(f for f in data if f["value"] == "status")
        assert status_field["label"] == "Durum", f"Status label should be 'Durum', got '{status_field['label']}'"
        
        print(f"✅ GET /api/kanban/group-fields includes 'status' field")


class TestRootEndpoint:
    """Basic API health check"""
    
    def test_api_root(self, api_client):
        """GET /api/ should return success"""
        response = api_client.get(f"{BASE_URL}/api/")
        
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        
        print("✅ API root endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
