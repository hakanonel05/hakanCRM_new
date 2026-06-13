"""
Test suite for Kanban API endpoints - Dynamic Kanban Boards feature
Tests: group-fields, views CRUD, customers grouping, field updates
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestKanbanGroupFields:
    """Test GET /api/kanban/group-fields endpoint"""
    
    def test_get_group_fields_returns_list(self):
        """Should return list of available grouping fields"""
        response = requests.get(f"{BASE_URL}/api/kanban/group-fields")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Verify structure
        for field in data:
            assert "value" in field
            assert "label" in field
    
    def test_group_fields_contains_expected_values(self):
        """Should contain status, assigned_to, potential_level, city, market, application"""
        response = requests.get(f"{BASE_URL}/api/kanban/group-fields")
        assert response.status_code == 200
        
        data = response.json()
        field_values = [f["value"] for f in data]
        
        expected_fields = ["status", "assigned_to", "potential_level", "city", "market", "application"]
        for expected in expected_fields:
            assert expected in field_values, f"Missing field: {expected}"


class TestKanbanViews:
    """Test Kanban Views CRUD endpoints"""
    
    @pytest.fixture
    def test_view_data(self):
        """Generate unique test view data"""
        return {
            "name": f"TEST_View_{uuid.uuid4().hex[:8]}",
            "group_by": "status",
            "description": "Test view for automated testing"
        }
    
    def test_get_views_returns_list(self):
        """GET /api/kanban/views should return list"""
        response = requests.get(f"{BASE_URL}/api/kanban/views")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_view_success(self, test_view_data):
        """POST /api/kanban/views should create new view"""
        response = requests.post(f"{BASE_URL}/api/kanban/views", json=test_view_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == test_view_data["name"]
        assert data["group_by"] == test_view_data["group_by"]
        assert "id" in data
        assert "created_at" in data
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/kanban/views/{data['id']}")
    
    def test_create_view_with_different_group_by(self):
        """Should create views with different group_by values"""
        group_by_options = ["status", "assigned_to", "potential_level", "city", "market", "application"]
        created_ids = []
        
        for group_by in group_by_options:
            view_data = {
                "name": f"TEST_View_{group_by}_{uuid.uuid4().hex[:6]}",
                "group_by": group_by,
                "description": f"Test view grouped by {group_by}"
            }
            response = requests.post(f"{BASE_URL}/api/kanban/views", json=view_data)
            assert response.status_code == 200, f"Failed to create view with group_by={group_by}"
            
            data = response.json()
            assert data["group_by"] == group_by
            created_ids.append(data["id"])
        
        # Cleanup
        for view_id in created_ids:
            requests.delete(f"{BASE_URL}/api/kanban/views/{view_id}")
    
    def test_update_view_success(self, test_view_data):
        """PUT /api/kanban/views/{view_id} should update view"""
        # Create view first
        create_response = requests.post(f"{BASE_URL}/api/kanban/views", json=test_view_data)
        assert create_response.status_code == 200
        view_id = create_response.json()["id"]
        
        # Update view
        updated_data = {
            "name": f"TEST_Updated_{uuid.uuid4().hex[:6]}",
            "group_by": "potential_level",
            "description": "Updated description"
        }
        update_response = requests.put(f"{BASE_URL}/api/kanban/views/{view_id}", json=updated_data)
        assert update_response.status_code == 200
        
        data = update_response.json()
        assert data["name"] == updated_data["name"]
        assert data["group_by"] == updated_data["group_by"]
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/kanban/views/{view_id}")
    
    def test_update_nonexistent_view_returns_404(self):
        """PUT /api/kanban/views/{invalid_id} should return 404"""
        response = requests.put(
            f"{BASE_URL}/api/kanban/views/nonexistent-id-12345",
            json={"name": "Test", "group_by": "status", "description": ""}
        )
        assert response.status_code == 404
    
    def test_delete_view_success(self, test_view_data):
        """DELETE /api/kanban/views/{view_id} should delete view"""
        # Create view first
        create_response = requests.post(f"{BASE_URL}/api/kanban/views", json=test_view_data)
        assert create_response.status_code == 200
        view_id = create_response.json()["id"]
        
        # Delete view
        delete_response = requests.delete(f"{BASE_URL}/api/kanban/views/{view_id}")
        assert delete_response.status_code == 200
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/kanban/views")
        views = get_response.json()
        view_ids = [v["id"] for v in views]
        assert view_id not in view_ids
    
    def test_delete_nonexistent_view_returns_404(self):
        """DELETE /api/kanban/views/{invalid_id} should return 404"""
        response = requests.delete(f"{BASE_URL}/api/kanban/views/nonexistent-id-12345")
        assert response.status_code == 404


class TestKanbanCustomers:
    """Test GET /api/kanban/customers endpoint with different group_by values"""
    
    def test_get_customers_by_status(self):
        """GET /api/kanban/customers?group_by=status should return grouped data"""
        response = requests.get(f"{BASE_URL}/api/kanban/customers?group_by=status")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, dict)
        
        # Should have status columns
        expected_statuses = ["Beklemede", "İletişimde", "Teklif Verildi", "Çalışılıyor", "Kazanıldı", "Kaybedildi"]
        for status in expected_statuses:
            if status in data:
                assert isinstance(data[status], list)
    
    def test_get_customers_by_assigned_to(self):
        """GET /api/kanban/customers?group_by=assigned_to should return grouped data"""
        response = requests.get(f"{BASE_URL}/api/kanban/customers?group_by=assigned_to")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, dict)
        
        # Each column should be a list of customers
        for column, customers in data.items():
            assert isinstance(customers, list)
    
    def test_get_customers_by_potential_level(self):
        """GET /api/kanban/customers?group_by=potential_level should return grouped data"""
        response = requests.get(f"{BASE_URL}/api/kanban/customers?group_by=potential_level")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, dict)
        
        # Should have potential level columns
        expected_levels = ["Yüksek", "Orta", "Düşük"]
        for level in expected_levels:
            if level in data:
                assert isinstance(data[level], list)
    
    def test_get_customers_by_city(self):
        """GET /api/kanban/customers?group_by=city should return grouped data"""
        response = requests.get(f"{BASE_URL}/api/kanban/customers?group_by=city")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, dict)
    
    def test_get_customers_by_market(self):
        """GET /api/kanban/customers?group_by=market should return grouped data"""
        response = requests.get(f"{BASE_URL}/api/kanban/customers?group_by=market")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, dict)
    
    def test_get_customers_by_application(self):
        """GET /api/kanban/customers?group_by=application should return grouped data"""
        response = requests.get(f"{BASE_URL}/api/kanban/customers?group_by=application")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, dict)
    
    def test_customers_have_required_fields(self):
        """Customers in response should have required fields"""
        response = requests.get(f"{BASE_URL}/api/kanban/customers?group_by=status")
        assert response.status_code == 200
        
        data = response.json()
        
        # Find first non-empty column
        for column, customers in data.items():
            if customers:
                customer = customers[0]
                assert "id" in customer
                assert "company_name" in customer
                break


class TestKanbanColumns:
    """Test GET /api/kanban/columns endpoint"""
    
    def test_get_columns_by_status(self):
        """GET /api/kanban/columns?group_by=status should return column config"""
        response = requests.get(f"{BASE_URL}/api/kanban/columns?group_by=status")
        assert response.status_code == 200
        
        data = response.json()
        assert "columns" in data
        assert "colors" in data
        assert "field_label" in data
        
        assert isinstance(data["columns"], list)
        assert isinstance(data["colors"], dict)
        assert data["field_label"] == "Durum"
    
    def test_get_columns_by_potential_level(self):
        """GET /api/kanban/columns?group_by=potential_level should return column config"""
        response = requests.get(f"{BASE_URL}/api/kanban/columns?group_by=potential_level")
        assert response.status_code == 200
        
        data = response.json()
        assert data["field_label"] == "Potansiyel"


class TestKanbanFieldUpdate:
    """Test PATCH /api/kanban/customers/{customer_id}/field endpoint"""
    
    @pytest.fixture
    def test_customer(self):
        """Create a test customer for field update tests"""
        customer_data = {
            "company_name": f"TEST_KanbanField_{uuid.uuid4().hex[:8]}",
            "status": "Beklemede",
            "assigned_to": "Test User",
            "potential_level": "Orta",
            "city": "İstanbul",
            "market": "Test Market",
            "application": "Test App"
        }
        response = requests.post(f"{BASE_URL}/api/customers", json=customer_data)
        assert response.status_code == 200
        customer = response.json()
        yield customer
        # Cleanup
        requests.delete(f"{BASE_URL}/api/customers/{customer['id']}")
    
    def test_update_assigned_to_field(self, test_customer):
        """PATCH should update assigned_to field"""
        customer_id = test_customer["id"]
        new_value = "New Assignee"
        
        response = requests.patch(
            f"{BASE_URL}/api/kanban/customers/{customer_id}/field?field=assigned_to&value={new_value}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["field"] == "assigned_to"
        assert data["value"] == new_value
        
        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/customers/{customer_id}")
        assert get_response.status_code == 200
        assert get_response.json()["assigned_to"] == new_value
    
    def test_update_potential_level_field(self, test_customer):
        """PATCH should update potential_level field"""
        customer_id = test_customer["id"]
        new_value = "Yüksek"
        
        response = requests.patch(
            f"{BASE_URL}/api/kanban/customers/{customer_id}/field?field=potential_level&value={new_value}"
        )
        assert response.status_code == 200
        
        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/customers/{customer_id}")
        assert get_response.status_code == 200
        assert get_response.json()["potential_level"] == new_value
    
    def test_update_city_field(self, test_customer):
        """PATCH should update city field"""
        customer_id = test_customer["id"]
        new_value = "Ankara"
        
        response = requests.patch(
            f"{BASE_URL}/api/kanban/customers/{customer_id}/field?field=city&value={new_value}"
        )
        assert response.status_code == 200
        
        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/customers/{customer_id}")
        assert get_response.status_code == 200
        assert get_response.json()["city"] == new_value
    
    def test_update_invalid_field_returns_400(self, test_customer):
        """PATCH with invalid field should return 400"""
        customer_id = test_customer["id"]
        
        response = requests.patch(
            f"{BASE_URL}/api/kanban/customers/{customer_id}/field?field=invalid_field&value=test"
        )
        assert response.status_code == 400
    
    def test_update_nonexistent_customer_returns_404(self):
        """PATCH for nonexistent customer should return 404"""
        response = requests.patch(
            f"{BASE_URL}/api/kanban/customers/nonexistent-id-12345/field?field=city&value=test"
        )
        assert response.status_code == 404


class TestKanbanStatusUpdate:
    """Test PATCH /api/kanban/customers/{customer_id}/status endpoint"""
    
    @pytest.fixture
    def test_customer(self):
        """Create a test customer for status update tests"""
        customer_data = {
            "company_name": f"TEST_KanbanStatus_{uuid.uuid4().hex[:8]}",
            "status": "Beklemede"
        }
        response = requests.post(f"{BASE_URL}/api/customers", json=customer_data)
        assert response.status_code == 200
        customer = response.json()
        yield customer
        # Cleanup
        requests.delete(f"{BASE_URL}/api/customers/{customer['id']}")
    
    def test_update_status_success(self, test_customer):
        """PATCH should update customer status"""
        customer_id = test_customer["id"]
        new_status = "İletişimde"
        
        response = requests.patch(
            f"{BASE_URL}/api/kanban/customers/{customer_id}/status?new_status={new_status}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["new_status"] == new_status
        
        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/customers/{customer_id}")
        assert get_response.status_code == 200
        assert get_response.json()["status"] == new_status
    
    def test_update_to_all_valid_statuses(self, test_customer):
        """Should be able to update to all valid statuses"""
        customer_id = test_customer["id"]
        valid_statuses = ["Beklemede", "İletişimde", "Teklif Verildi", "Çalışılıyor", "Kazanıldı", "Kaybedildi"]
        
        for status in valid_statuses:
            response = requests.patch(
                f"{BASE_URL}/api/kanban/customers/{customer_id}/status?new_status={status}"
            )
            assert response.status_code == 200, f"Failed to update to status: {status}"
    
    def test_update_invalid_status_returns_400(self, test_customer):
        """PATCH with invalid status should return 400"""
        customer_id = test_customer["id"]
        
        response = requests.patch(
            f"{BASE_URL}/api/kanban/customers/{customer_id}/status?new_status=InvalidStatus"
        )
        assert response.status_code == 400
    
    def test_update_nonexistent_customer_returns_404(self):
        """PATCH for nonexistent customer should return 404"""
        response = requests.patch(
            f"{BASE_URL}/api/kanban/customers/nonexistent-id-12345/status?new_status=Beklemede"
        )
        assert response.status_code == 404


# Cleanup fixture to remove all TEST_ prefixed views after tests
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_views():
    """Cleanup TEST_ prefixed views after all tests"""
    yield
    # Cleanup
    response = requests.get(f"{BASE_URL}/api/kanban/views")
    if response.status_code == 200:
        views = response.json()
        for view in views:
            if view.get("name", "").startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/kanban/views/{view['id']}")
