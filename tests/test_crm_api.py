"""
CRM API Tests - Testing customers, calls, options, and visits endpoints
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://button-consolidation.preview.emergentagent.com')

class TestAPIHealth:
    """Basic API health checks"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == "CRM API is running"
        print("✓ API root endpoint working")


class TestOptionsAPI:
    """Test /api/options/grouped endpoint"""
    
    def test_get_options_grouped(self):
        """Test getting grouped options"""
        response = requests.get(f"{BASE_URL}/api/options/grouped")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Options grouped endpoint returned {len(data)} options")
        
        # Verify structure
        if len(data) > 0:
            option = data[0]
            assert "id" in option
            assert "field_name" in option
            assert "value" in option
            print("✓ Option structure is correct")
    
    def test_create_option(self):
        """Test creating a new option"""
        unique_value = f"TEST_Option_{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/options", json={
            "field_name": "market",
            "value": unique_value,
            "color": "#ff0000"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["value"] == unique_value
        assert data["field_name"] == "market"
        print(f"✓ Created option: {unique_value}")


class TestCustomersAPI:
    """Test /api/customers endpoints"""
    
    def test_get_customers(self):
        """Test getting all customers"""
        response = requests.get(f"{BASE_URL}/api/customers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Customers endpoint returned {len(data)} customers")
    
    def test_create_customer(self):
        """Test creating a new customer"""
        unique_name = f"TEST_Company_{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/customers", json={
            "company_name": unique_name,
            "market": "Test Market",
            "application": "Test App",
            "city": "İstanbul",
            "status": "Beklemede",
            "contact_info": {
                "contact_person": "Test Person",
                "email": "test@example.com",
                "phone": "+90 555 123 4567"
            }
        })
        assert response.status_code == 200
        data = response.json()
        assert data["company_name"] == unique_name
        assert "id" in data
        print(f"✓ Created customer: {unique_name}")
        return data["id"]
    
    def test_get_customer_by_id(self):
        """Test getting a specific customer"""
        # First create a customer
        unique_name = f"TEST_GetById_{uuid.uuid4().hex[:8]}"
        create_response = requests.post(f"{BASE_URL}/api/customers", json={
            "company_name": unique_name,
            "market": "Test Market"
        })
        customer_id = create_response.json()["id"]
        
        # Then get it by ID
        response = requests.get(f"{BASE_URL}/api/customers/{customer_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == customer_id
        assert data["company_name"] == unique_name
        print(f"✓ Retrieved customer by ID: {customer_id}")
    
    def test_update_customer(self):
        """Test updating a customer"""
        # First create a customer
        unique_name = f"TEST_Update_{uuid.uuid4().hex[:8]}"
        create_response = requests.post(f"{BASE_URL}/api/customers", json={
            "company_name": unique_name,
            "market": "Original Market"
        })
        customer_id = create_response.json()["id"]
        
        # Update the customer
        updated_name = f"{unique_name}_Updated"
        response = requests.put(f"{BASE_URL}/api/customers/{customer_id}", json={
            "company_name": updated_name,
            "market": "Updated Market"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["company_name"] == updated_name
        assert data["market"] == "Updated Market"
        print(f"✓ Updated customer: {customer_id}")
    
    def test_customer_search(self):
        """Test customer search functionality"""
        response = requests.get(f"{BASE_URL}/api/customers?search=Test")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Search returned {len(data)} results")
    
    def test_customer_filter_by_market(self):
        """Test filtering customers by market"""
        response = requests.get(f"{BASE_URL}/api/customers?market=F%26B")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Market filter returned {len(data)} results")


class TestCallsAPI:
    """Test /api/calls endpoints - New Aramalar feature"""
    
    @pytest.fixture
    def test_customer_id(self):
        """Create a test customer for call tests"""
        unique_name = f"TEST_CallCustomer_{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/customers", json={
            "company_name": unique_name,
            "market": "Test Market"
        })
        return response.json()["id"]
    
    def test_get_calls(self):
        """Test getting all calls"""
        response = requests.get(f"{BASE_URL}/api/calls")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Calls endpoint returned {len(data)} calls")
    
    def test_create_call(self, test_customer_id):
        """Test creating a new call"""
        response = requests.post(f"{BASE_URL}/api/calls", json={
            "customer_id": test_customer_id,
            "call_date": "2025-01-03",
            "caller_name": "Test Caller",
            "contact_person": "Test Contact",
            "phone_number": "+90 555 123 4567",
            "duration_minutes": 15,
            "call_type": "Giden",
            "outcome": "Olumlu görüşme",
            "notes": "Test call notes",
            "next_action": "Follow up",
            "next_action_date": "2025-01-10"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["customer_id"] == test_customer_id
        assert data["caller_name"] == "Test Caller"
        assert data["call_type"] == "Giden"
        assert "id" in data
        print(f"✓ Created call for customer: {test_customer_id}")
        return data["id"]
    
    def test_get_calls_by_customer(self, test_customer_id):
        """Test getting calls for a specific customer"""
        # First create a call
        requests.post(f"{BASE_URL}/api/calls", json={
            "customer_id": test_customer_id,
            "call_date": "2025-01-03",
            "call_type": "Gelen",
            "notes": "Test call"
        })
        
        # Get calls for this customer
        response = requests.get(f"{BASE_URL}/api/calls?customer_id={test_customer_id}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert all(call["customer_id"] == test_customer_id for call in data)
        print(f"✓ Retrieved {len(data)} calls for customer: {test_customer_id}")
    
    def test_get_call_by_id(self, test_customer_id):
        """Test getting a specific call by ID"""
        # Create a call
        create_response = requests.post(f"{BASE_URL}/api/calls", json={
            "customer_id": test_customer_id,
            "call_date": "2025-01-03",
            "call_type": "Giden",
            "notes": "Test call for get by ID"
        })
        call_id = create_response.json()["id"]
        
        # Get by ID
        response = requests.get(f"{BASE_URL}/api/calls/{call_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == call_id
        print(f"✓ Retrieved call by ID: {call_id}")
    
    def test_update_call(self, test_customer_id):
        """Test updating a call"""
        # Create a call
        create_response = requests.post(f"{BASE_URL}/api/calls", json={
            "customer_id": test_customer_id,
            "call_date": "2025-01-03",
            "call_type": "Giden",
            "notes": "Original notes"
        })
        call_id = create_response.json()["id"]
        
        # Update the call
        response = requests.put(f"{BASE_URL}/api/calls/{call_id}", json={
            "customer_id": test_customer_id,
            "call_date": "2025-01-04",
            "call_type": "Gelen",
            "notes": "Updated notes",
            "outcome": "Successful"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["notes"] == "Updated notes"
        assert data["call_type"] == "Gelen"
        print(f"✓ Updated call: {call_id}")


class TestVisitsAPI:
    """Test /api/visits endpoints"""
    
    @pytest.fixture
    def test_customer_id(self):
        """Create a test customer for visit tests"""
        unique_name = f"TEST_VisitCustomer_{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/customers", json={
            "company_name": unique_name,
            "market": "Test Market"
        })
        return response.json()["id"]
    
    def test_get_visits(self):
        """Test getting all visits"""
        response = requests.get(f"{BASE_URL}/api/visits")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Visits endpoint returned {len(data)} visits")
    
    def test_create_visit(self, test_customer_id):
        """Test creating a new visit"""
        response = requests.post(f"{BASE_URL}/api/visits", json={
            "customer_id": test_customer_id,
            "visit_date": "2025-01-03",
            "visit_type": "Yüz Yüze",
            "notes": "Test visit notes",
            "outcome": "Productive meeting"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["customer_id"] == test_customer_id
        assert data["visit_type"] == "Yüz Yüze"
        assert "id" in data
        print(f"✓ Created visit for customer: {test_customer_id}")


class TestStatsAPI:
    """Test /api/stats endpoint"""
    
    def test_get_stats(self):
        """Test getting dashboard stats"""
        response = requests.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_customers" in data
        assert "total_visits" in data
        assert "status_distribution" in data
        print(f"✓ Stats: {data['total_customers']} customers, {data['total_visits']} visits")


class TestKanbanAPI:
    """Test /api/kanban endpoints"""
    
    def test_get_kanban_statuses(self):
        """Test getting Kanban statuses"""
        response = requests.get(f"{BASE_URL}/api/kanban/statuses")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"✓ Kanban statuses: {len(data)} columns")
    
    def test_get_kanban_customers(self):
        """Test getting customers grouped by status"""
        response = requests.get(f"{BASE_URL}/api/kanban/customers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        print(f"✓ Kanban customers grouped by {len(data)} statuses")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
