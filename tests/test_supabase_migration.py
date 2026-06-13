"""
Test suite for CRMaster Supabase PostgreSQL Migration
Tests all CRUD operations for customers, visits, calls, filters, kanban views
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAPIHealth:
    """Test API health and basic connectivity"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "CRM API is running" in data["message"]
        print("✅ API root endpoint working")


class TestCustomersCRUD:
    """Test Customer CRUD operations"""
    
    @pytest.fixture
    def test_customer_data(self):
        return {
            "company_name": f"TEST_Company_{uuid.uuid4().hex[:8]}",
            "market": "Metal",
            "application": "CNC",
            "city": "İstanbul",
            "district": "Kadıköy",
            "website": "https://test.com",
            "status": "Beklemede",
            "contact_info": {
                "contact_person": "Test Kişi",
                "email": "test@test.com",
                "phone": "+90 555 111 2222"
            },
            "potential_level": "Yüksek",
            "assigned_to": "Test User"
        }
    
    def test_get_customers_list(self):
        """GET /api/customers - Müşteri listesi"""
        response = requests.get(f"{BASE_URL}/api/customers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/customers - {len(data)} müşteri bulundu")
    
    def test_create_customer(self, test_customer_data):
        """POST /api/customers - Müşteri oluştur"""
        response = requests.post(f"{BASE_URL}/api/customers", json=test_customer_data)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["company_name"] == test_customer_data["company_name"]
        assert data["market"] == test_customer_data["market"]
        assert data["city"] == test_customer_data["city"]
        print(f"✅ POST /api/customers - Müşteri oluşturuldu: {data['id']}")
        return data["id"]
    
    def test_create_and_get_customer(self, test_customer_data):
        """Create customer and verify with GET"""
        # Create
        create_response = requests.post(f"{BASE_URL}/api/customers", json=test_customer_data)
        assert create_response.status_code == 200
        created = create_response.json()
        customer_id = created["id"]
        
        # Get by ID
        get_response = requests.get(f"{BASE_URL}/api/customers/{customer_id}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["company_name"] == test_customer_data["company_name"]
        print(f"✅ Create → GET verification passed for customer {customer_id}")
    
    def test_update_customer(self, test_customer_data):
        """PUT /api/customers/{id} - Müşteri güncelle"""
        # Create first
        create_response = requests.post(f"{BASE_URL}/api/customers", json=test_customer_data)
        assert create_response.status_code == 200
        customer_id = create_response.json()["id"]
        
        # Update
        update_data = {
            "company_name": f"UPDATED_{test_customer_data['company_name']}",
            "status": "İletişimde",
            "potential_level": "Orta"
        }
        update_response = requests.put(f"{BASE_URL}/api/customers/{customer_id}", json=update_data)
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["status"] == "İletişimde"
        
        # Verify with GET
        get_response = requests.get(f"{BASE_URL}/api/customers/{customer_id}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["status"] == "İletişimde"
        print(f"✅ PUT /api/customers/{customer_id} - Müşteri güncellendi")
    
    def test_customer_search(self, test_customer_data):
        """Test customer search functionality"""
        # Create customer with unique name
        unique_name = f"SEARCHTEST_{uuid.uuid4().hex[:8]}"
        test_customer_data["company_name"] = unique_name
        create_response = requests.post(f"{BASE_URL}/api/customers", json=test_customer_data)
        assert create_response.status_code == 200
        
        # Search
        search_response = requests.get(f"{BASE_URL}/api/customers", params={"search": unique_name})
        assert search_response.status_code == 200
        results = search_response.json()
        assert len(results) >= 1
        assert any(unique_name in c["company_name"] for c in results)
        print(f"✅ Customer search working for '{unique_name}'")


class TestKanbanFeatures:
    """Test Kanban board features"""
    
    def test_kanban_customers_by_status(self):
        """GET /api/kanban/customers?group_by=status - Kanban grupları"""
        response = requests.get(f"{BASE_URL}/api/kanban/customers", params={"group_by": "status"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        # Should have status columns
        expected_statuses = ["Beklemede", "İletişimde", "Teklif Verildi", "Çalışılıyor", "Kazanıldı", "Kaybedildi"]
        for status in expected_statuses:
            if status in data:
                assert isinstance(data[status], list)
        print(f"✅ GET /api/kanban/customers?group_by=status - {len(data)} kolon")
    
    def test_kanban_customers_by_potential(self):
        """Test Kanban grouping by potential_level"""
        response = requests.get(f"{BASE_URL}/api/kanban/customers", params={"group_by": "potential_level"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        print(f"✅ GET /api/kanban/customers?group_by=potential_level - {len(data)} kolon")
    
    def test_kanban_views_list(self):
        """GET /api/kanban/views - Kanban görünümleri"""
        response = requests.get(f"{BASE_URL}/api/kanban/views")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/kanban/views - {len(data)} görünüm")
    
    def test_kanban_view_crud(self):
        """POST /api/kanban/views - Görünüm oluştur"""
        view_data = {
            "name": f"TEST_View_{uuid.uuid4().hex[:8]}",
            "group_by": "status",
            "description": "Test view for migration testing"
        }
        
        # Create
        create_response = requests.post(f"{BASE_URL}/api/kanban/views", json=view_data)
        assert create_response.status_code == 200
        created = create_response.json()
        assert "id" in created
        view_id = created["id"]
        print(f"✅ POST /api/kanban/views - Görünüm oluşturuldu: {view_id}")
        
        # Verify in list
        list_response = requests.get(f"{BASE_URL}/api/kanban/views")
        assert list_response.status_code == 200
        views = list_response.json()
        assert any(v["id"] == view_id for v in views)
        
        # Delete
        delete_response = requests.delete(f"{BASE_URL}/api/kanban/views/{view_id}")
        assert delete_response.status_code == 200
        print(f"✅ DELETE /api/kanban/views/{view_id} - Görünüm silindi")
    
    def test_kanban_group_fields(self):
        """Test kanban group fields endpoint"""
        response = requests.get(f"{BASE_URL}/api/kanban/group-fields")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 6  # status, assigned_to, potential_level, city, market, application
        print(f"✅ GET /api/kanban/group-fields - {len(data)} alan")


class TestVisitsCRUD:
    """Test Visits CRUD operations"""
    
    @pytest.fixture
    def test_customer_id(self):
        """Create a test customer and return its ID"""
        customer_data = {
            "company_name": f"TEST_VisitCustomer_{uuid.uuid4().hex[:8]}",
            "status": "Beklemede"
        }
        response = requests.post(f"{BASE_URL}/api/customers", json=customer_data)
        return response.json()["id"]
    
    def test_get_visits_list(self):
        """GET /api/visits - Ziyaretler"""
        response = requests.get(f"{BASE_URL}/api/visits")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/visits - {len(data)} ziyaret")
    
    def test_create_visit(self, test_customer_id):
        """POST /api/visits - Ziyaret oluştur"""
        visit_data = {
            "customer_id": test_customer_id,
            "visit_date": "2026-01-15",
            "visit_type": "Yüz Yüze",
            "contact_person": "Test Kişi",
            "notes": "Test ziyaret notları",
            "outcome": "Olumlu"
        }
        
        response = requests.post(f"{BASE_URL}/api/visits", json=visit_data)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["customer_id"] == test_customer_id
        assert data["visit_type"] == "Yüz Yüze"
        print(f"✅ POST /api/visits - Ziyaret oluşturuldu: {data['id']}")
        
        # Verify with GET
        get_response = requests.get(f"{BASE_URL}/api/visits/{data['id']}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["notes"] == "Test ziyaret notları"
    
    def test_get_customer_visits(self, test_customer_id):
        """Test getting visits for a specific customer"""
        # Create a visit
        visit_data = {
            "customer_id": test_customer_id,
            "visit_date": "2026-01-20",
            "visit_type": "Online",
            "notes": "Customer specific visit"
        }
        requests.post(f"{BASE_URL}/api/visits", json=visit_data)
        
        # Get visits for customer
        response = requests.get(f"{BASE_URL}/api/visits", params={"customer_id": test_customer_id})
        assert response.status_code == 200
        visits = response.json()
        assert isinstance(visits, list)
        assert all(v["customer_id"] == test_customer_id for v in visits)
        print(f"✅ GET /api/visits?customer_id={test_customer_id} - {len(visits)} ziyaret")


class TestCallsCRUD:
    """Test Calls CRUD operations"""
    
    @pytest.fixture
    def test_customer_id(self):
        """Create a test customer and return its ID"""
        customer_data = {
            "company_name": f"TEST_CallCustomer_{uuid.uuid4().hex[:8]}",
            "status": "Beklemede"
        }
        response = requests.post(f"{BASE_URL}/api/customers", json=customer_data)
        return response.json()["id"]
    
    def test_get_calls_list(self):
        """GET /api/calls - Aramalar"""
        response = requests.get(f"{BASE_URL}/api/calls")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/calls - {len(data)} arama")
    
    def test_create_call(self, test_customer_id):
        """POST /api/calls - Arama oluştur"""
        call_data = {
            "customer_id": test_customer_id,
            "call_date": "2026-01-10",
            "caller_name": "Test Arayan",
            "contact_person": "Test Kişi",
            "phone_number": "+90 555 333 4444",
            "duration_minutes": 15,
            "call_type": "Giden",
            "outcome": "Olumlu",
            "notes": "Test arama notları"
        }
        
        response = requests.post(f"{BASE_URL}/api/calls", json=call_data)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["customer_id"] == test_customer_id
        assert data["call_type"] == "Giden"
        assert data["duration_minutes"] == 15
        print(f"✅ POST /api/calls - Arama oluşturuldu: {data['id']}")
        
        # Verify with GET
        get_response = requests.get(f"{BASE_URL}/api/calls/{data['id']}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["notes"] == "Test arama notları"
    
    def test_get_customer_calls(self, test_customer_id):
        """Test getting calls for a specific customer"""
        # Create a call
        call_data = {
            "customer_id": test_customer_id,
            "call_date": "2026-01-12",
            "call_type": "Gelen",
            "notes": "Customer specific call"
        }
        requests.post(f"{BASE_URL}/api/calls", json=call_data)
        
        # Get calls for customer
        response = requests.get(f"{BASE_URL}/api/customers/{test_customer_id}/calls")
        assert response.status_code == 200
        calls = response.json()
        assert isinstance(calls, list)
        print(f"✅ GET /api/customers/{test_customer_id}/calls - {len(calls)} arama")


class TestFiltersCRUD:
    """Test Saved Filters CRUD operations"""
    
    def test_get_filters_list(self):
        """GET /api/filters - Filtreler"""
        response = requests.get(f"{BASE_URL}/api/filters")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/filters - {len(data)} filtre")
    
    def test_create_filter(self):
        """POST /api/filters - Filtre oluştur"""
        filter_data = {
            "name": f"TEST_Filter_{uuid.uuid4().hex[:8]}",
            "conditions": [
                {"field": "status", "operator": "equals", "value": "Beklemede"},
                {"field": "city", "operator": "equals", "value": "İstanbul"}
            ],
            "logic": "AND"
        }
        
        response = requests.post(f"{BASE_URL}/api/filters", json=filter_data)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["name"] == filter_data["name"]
        assert len(data["conditions"]) == 2
        print(f"✅ POST /api/filters - Filtre oluşturuldu: {data['id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/filters/{data['id']}")
    
    def test_apply_filter(self):
        """Test applying a saved filter"""
        # Create filter
        filter_data = {
            "name": f"TEST_ApplyFilter_{uuid.uuid4().hex[:8]}",
            "conditions": [
                {"field": "status", "operator": "equals", "value": "Beklemede"}
            ],
            "logic": "AND"
        }
        create_response = requests.post(f"{BASE_URL}/api/filters", json=filter_data)
        filter_id = create_response.json()["id"]
        
        # Apply filter
        apply_response = requests.post(f"{BASE_URL}/api/filters/{filter_id}/apply")
        assert apply_response.status_code == 200
        results = apply_response.json()
        assert isinstance(results, list)
        print(f"✅ POST /api/filters/{filter_id}/apply - {len(results)} sonuç")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/filters/{filter_id}")


class TestDashboardStats:
    """Test Dashboard statistics endpoint"""
    
    def test_get_stats(self):
        """GET /api/stats - Dashboard istatistikleri"""
        response = requests.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200
        data = response.json()
        
        # Verify expected fields
        assert "total_customers" in data
        assert "total_visits" in data
        assert "status_distribution" in data
        assert "market_distribution" in data
        assert "city_distribution" in data
        assert "recent_customers" in data
        
        assert isinstance(data["total_customers"], int)
        assert isinstance(data["total_visits"], int)
        assert isinstance(data["status_distribution"], list)
        
        print(f"✅ GET /api/stats - {data['total_customers']} müşteri, {data['total_visits']} ziyaret")


class TestAuthEndpoints:
    """Test Authentication endpoints"""
    
    def test_register_user(self):
        """POST /api/auth/register - Kayıt"""
        unique_email = f"test_{uuid.uuid4().hex[:8]}@test.com"
        register_data = {
            "email": unique_email,
            "password": "testpass123",
            "name": "Test User"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=register_data)
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert data["email"] == unique_email
        assert data["name"] == "Test User"
        assert data["auth_type"] == "local"
        print(f"✅ POST /api/auth/register - Kullanıcı kaydedildi: {unique_email}")
    
    def test_login_user(self):
        """POST /api/auth/login - Giriş"""
        # First register
        unique_email = f"login_test_{uuid.uuid4().hex[:8]}@test.com"
        register_data = {
            "email": unique_email,
            "password": "logintest123",
            "name": "Login Test User"
        }
        requests.post(f"{BASE_URL}/api/auth/register", json=register_data)
        
        # Then login
        login_data = {
            "email": unique_email,
            "password": "logintest123"
        }
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == unique_email
        print(f"✅ POST /api/auth/login - Giriş başarılı: {unique_email}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        login_data = {
            "email": "nonexistent@test.com",
            "password": "wrongpassword"
        }
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        assert response.status_code == 401
        print("✅ POST /api/auth/login - Geçersiz kimlik bilgileri reddedildi")
    
    def test_auth_me_without_session(self):
        """Test /auth/me without session"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("✅ GET /api/auth/me - Oturumsuz erişim reddedildi")


class TestOptionsEndpoints:
    """Test Options (dynamic fields) endpoints"""
    
    def test_get_all_options(self):
        """GET /api/options - All options"""
        response = requests.get(f"{BASE_URL}/api/options")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/options - {len(data)} seçenek")
    
    def test_get_options_by_field(self):
        """GET /api/options/{field_name}"""
        response = requests.get(f"{BASE_URL}/api/options/status")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/options/status - {len(data)} durum seçeneği")
    
    def test_create_option(self):
        """POST /api/options - Create option"""
        option_data = {
            "field_name": "test_field",
            "value": f"TEST_Option_{uuid.uuid4().hex[:8]}",
            "color": "blue"
        }
        response = requests.post(f"{BASE_URL}/api/options", json=option_data)
        assert response.status_code == 200
        data = response.json()
        assert data["field_name"] == "test_field"
        print(f"✅ POST /api/options - Seçenek oluşturuldu")


class TestCalendarEvents:
    """Test Calendar events endpoint"""
    
    def test_get_calendar_events(self):
        """GET /api/calendar-events"""
        response = requests.get(f"{BASE_URL}/api/calendar-events")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/calendar-events - {len(data)} etkinlik")


class TestNotifications:
    """Test Notifications endpoint"""
    
    def test_get_notifications(self):
        """GET /api/notifications"""
        response = requests.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 200
        data = response.json()
        assert "notifications" in data
        assert "count" in data
        assert "notification_days" in data
        print(f"✅ GET /api/notifications - {data['count']} bildirim")


class TestFollowups:
    """Test Followups endpoint"""
    
    def test_get_followups(self):
        """GET /api/followups"""
        response = requests.get(f"{BASE_URL}/api/followups")
        assert response.status_code == 200
        data = response.json()
        assert "customers" in data
        assert "visits" in data
        print(f"✅ GET /api/followups - {len(data['customers'])} müşteri, {len(data['visits'])} ziyaret")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
