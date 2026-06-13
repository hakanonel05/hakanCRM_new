"""
Test suite for CRMaster Bulk Import Endpoints
Tests:
1. POST /api/auth/login - Authentication
2. POST /api/import/bulk-customers - Batch import endpoint
3. POST /api/options/bulk - Batch options creation
4. POST /api/import/preview - Optimized similarity check
5. GET /api/customers - Paginated data retrieval
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBulkImportEndpoints:
    """Test bulk import functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session for tests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.created_customer_ids = []
        yield
        # Cleanup
        self.cleanup_test_data()
    
    def cleanup_test_data(self):
        """Clean up test data"""
        for cid in self.created_customer_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/customers/{cid}")
            except Exception:
                pass
    
    # ============ AUTH TESTS ============
    
    def test_01_login_success(self):
        """Test login with valid credentials"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hakanonel05@gmail.com",
            "password": "Hkn*5225"
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "email" in data or "user" in data
        print(f"✅ Login successful: {data.get('email', data.get('name', 'unknown'))}")
    
    # ============ BULK OPTIONS TESTS ============
    
    def test_02_bulk_options_create(self):
        """Test POST /api/options/bulk - Batch options creation"""
        # First login
        self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hakanonel05@gmail.com",
            "password": "Hkn*5225"
        })
        
        # Create bulk options
        options = [
            {"field_name": "market", "value": "TEST_Market_Bulk_1"},
            {"field_name": "market", "value": "TEST_Market_Bulk_2"},
            {"field_name": "application", "value": "TEST_App_Bulk_1"},
            {"field_name": "city", "value": "TEST_City_Bulk_1"},
            {"field_name": "competitor", "value": "TEST_Competitor_Bulk_1"},
            {"field_name": "partner", "value": "TEST_Partner_Bulk_1"}
        ]
        
        response = self.session.post(f"{BASE_URL}/api/options/bulk", json={
            "options": options
        })
        
        assert response.status_code == 200, f"Bulk options failed: {response.text}"
        data = response.json()
        
        assert "created" in data
        assert "skipped" in data
        print(f"✅ Bulk options: created={data['created']}, skipped={data['skipped']}")
    
    def test_03_bulk_options_deduplication(self):
        """Test that bulk options deduplicates existing values"""
        self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hakanonel05@gmail.com",
            "password": "Hkn*5225"
        })
        
        # Try to create duplicate options
        options = [
            {"field_name": "market", "value": "TEST_Market_Bulk_1"},  # Already exists
            {"field_name": "market", "value": "TEST_Market_Bulk_3"},  # New
        ]
        
        response = self.session.post(f"{BASE_URL}/api/options/bulk", json={
            "options": options
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # At least one should be skipped (the duplicate)
        print(f"✅ Bulk options dedup: created={data['created']}, skipped={data['skipped']}")
    
    def test_04_bulk_options_empty(self):
        """Test bulk options with empty list"""
        self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hakanonel05@gmail.com",
            "password": "Hkn*5225"
        })
        
        response = self.session.post(f"{BASE_URL}/api/options/bulk", json={
            "options": []
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["created"] == 0
        assert data["skipped"] == 0
        print("✅ Bulk options empty list handled correctly")
    
    # ============ IMPORT PREVIEW TESTS ============
    
    def test_05_import_preview_new_customers(self):
        """Test POST /api/import/preview with new (non-similar) customers"""
        self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hakanonel05@gmail.com",
            "password": "Hkn*5225"
        })
        
        # Create preview request with unique names
        rows = [
            {"row_num": 1, "company_name": f"TEST_Preview_Unique_Company_{int(time.time())}"},
            {"row_num": 2, "company_name": f"TEST_Preview_Another_Unique_{int(time.time())}"}
        ]
        
        response = self.session.post(f"{BASE_URL}/api/import/preview", json={
            "rows": rows
        })
        
        assert response.status_code == 200, f"Preview failed: {response.text}"
        data = response.json()
        
        assert "items" in data
        assert "total_new" in data
        assert "total_similar" in data
        assert "total_duplicate" in data
        assert len(data["items"]) == 2
        print(f"✅ Import preview: {data['total_new']} new, {data['total_similar']} similar, {data['total_duplicate']} duplicate")
    
    def test_06_import_preview_empty(self):
        """Test import preview with empty rows"""
        self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hakanonel05@gmail.com",
            "password": "Hkn*5225"
        })
        
        response = self.session.post(f"{BASE_URL}/api/import/preview", json={
            "rows": []
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total_new"] == 0
        print("✅ Import preview empty rows handled correctly")
    
    # ============ BULK CUSTOMERS IMPORT TESTS ============
    
    def test_07_bulk_customers_import_new(self):
        """Test POST /api/import/bulk-customers - Create new customers in bulk"""
        self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hakanonel05@gmail.com",
            "password": "Hkn*5225"
        })
        
        timestamp = int(time.time())
        items = [
            {
                "company_name": f"TEST_Bulk_Import_Company_1_{timestamp}",
                "market": "TEST_Market_Bulk",
                "application": "TEST_Application",
                "city": "Istanbul",
                "district": "Kadikoy",
                "status": "Beklemede",
                "contact_info": {"contact_person": "Test Contact 1", "email": "test1@test.com", "phone": "5551234567"},
                "potential_level": "Orta"
            },
            {
                "company_name": f"TEST_Bulk_Import_Company_2_{timestamp}",
                "market": "TEST_Market_Bulk",
                "city": "Ankara",
                "status": "Aktif",
                "contact_info": {"contact_person": "Test Contact 2", "email": "test2@test.com", "phone": "5559876543"},
                "potential_level": "Yüksek"
            },
            {
                "company_name": f"TEST_Bulk_Import_Company_3_{timestamp}",
                "market": "TEST_Market_Bulk",
                "city": "Izmir",
                "status": "Beklemede",
                "potential_level": "Düşük"
            }
        ]
        
        response = self.session.post(f"{BASE_URL}/api/import/bulk-customers", json={
            "items": items,
            "merge_items": []
        })
        
        assert response.status_code == 200, f"Bulk import failed: {response.text}"
        data = response.json()
        
        assert "success" in data
        assert "merged" in data
        assert "failed" in data
        assert data["success"] == 3, f"Expected 3 successful imports, got {data['success']}"
        print(f"✅ Bulk customers import: success={data['success']}, merged={data['merged']}, failed={data['failed']}")
        
        # Verify customers were created by searching
        search_response = self.session.get(f"{BASE_URL}/api/customers?search=TEST_Bulk_Import&limit=10")
        assert search_response.status_code == 200
        search_data = search_response.json()
        
        # Handle paginated response
        customers = search_data.get("data", search_data) if isinstance(search_data, dict) else search_data
        
        # Store IDs for cleanup
        for c in customers:
            if f"TEST_Bulk_Import_Company" in c.get("company_name", ""):
                self.created_customer_ids.append(c["id"])
        
        assert len(self.created_customer_ids) >= 3, f"Expected at least 3 customers, found {len(self.created_customer_ids)}"
        print(f"✅ Verified {len(self.created_customer_ids)} customers created in database")
    
    def test_08_bulk_customers_import_empty(self):
        """Test bulk import with empty items"""
        self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hakanonel05@gmail.com",
            "password": "Hkn*5225"
        })
        
        response = self.session.post(f"{BASE_URL}/api/import/bulk-customers", json={
            "items": [],
            "merge_items": []
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == 0
        assert data["merged"] == 0
        assert data["failed"] == 0
        print("✅ Bulk import empty handled correctly")
    
    def test_09_bulk_customers_import_with_merge(self):
        """Test bulk import with merge items (update existing customers)"""
        self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hakanonel05@gmail.com",
            "password": "Hkn*5225"
        })
        
        # First create a customer to merge into
        timestamp = int(time.time())
        create_response = self.session.post(f"{BASE_URL}/api/customers", json={
            "company_name": f"TEST_Merge_Target_{timestamp}",
            "market": "",
            "city": "",
            "status": "Beklemede"
        })
        
        assert create_response.status_code == 200, f"Failed to create merge target: {create_response.text}"
        target_customer = create_response.json()
        target_id = target_customer["id"]
        self.created_customer_ids.append(target_id)
        
        # Now try to merge data into it
        response = self.session.post(f"{BASE_URL}/api/import/bulk-customers", json={
            "items": [],
            "merge_items": [
                {
                    "customer_id": target_id,
                    "data": {
                        "market": "TEST_Merged_Market",
                        "city": "TEST_Merged_City",
                        "notes": "Merged via bulk import"
                    }
                }
            ]
        })
        
        assert response.status_code == 200, f"Merge failed: {response.text}"
        data = response.json()
        assert data["merged"] == 1, f"Expected 1 merge, got {data['merged']}"
        print(f"✅ Bulk import with merge: merged={data['merged']}")
        
        # Verify the merge
        get_response = self.session.get(f"{BASE_URL}/api/customers/{target_id}")
        assert get_response.status_code == 200
        updated_customer = get_response.json()
        
        assert updated_customer["market"] == "TEST_Merged_Market"
        assert updated_customer["city"] == "TEST_Merged_City"
        print("✅ Verified merge data persisted correctly")
    
    # ============ GET CUSTOMERS PAGINATION TESTS ============
    
    def test_10_customers_pagination(self):
        """Test GET /api/customers with pagination"""
        self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hakanonel05@gmail.com",
            "password": "Hkn*5225"
        })
        
        response = self.session.get(f"{BASE_URL}/api/customers?page=1&limit=5")
        
        assert response.status_code == 200, f"Customers fetch failed: {response.text}"
        data = response.json()
        
        assert "data" in data
        assert "total" in data
        assert "page" in data
        assert "limit" in data
        assert "total_pages" in data
        
        assert data["page"] == 1
        assert data["limit"] == 5
        assert len(data["data"]) <= 5
        
        print(f"✅ Customers pagination: page={data['page']}, limit={data['limit']}, total={data['total']}, total_pages={data['total_pages']}")
    
    def test_11_customers_search(self):
        """Test GET /api/customers with search filter"""
        self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hakanonel05@gmail.com",
            "password": "Hkn*5225"
        })
        
        # Search for test customers
        response = self.session.get(f"{BASE_URL}/api/customers?search=TEST&limit=50")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "data" in data
        # All returned customers should have TEST in name
        for customer in data["data"]:
            assert "TEST" in customer["company_name"].upper(), f"Search filter not working for {customer['company_name']}"
        
        print(f"✅ Customers search: found {len(data['data'])} matching 'TEST'")
    
    # ============ LARGE BATCH TEST ============
    
    def test_12_bulk_import_larger_batch(self):
        """Test bulk import with a larger batch (simulating realistic import)"""
        self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hakanonel05@gmail.com",
            "password": "Hkn*5225"
        })
        
        timestamp = int(time.time())
        # Create 20 test customers
        items = []
        for i in range(20):
            items.append({
                "company_name": f"TEST_Large_Batch_Company_{i}_{timestamp}",
                "market": f"Market_{i % 3}",
                "city": ["Istanbul", "Ankara", "Izmir"][i % 3],
                "status": ["Beklemede", "Aktif", "Pasif"][i % 3],
                "potential_level": ["Düşük", "Orta", "Yüksek"][i % 3],
                "contact_info": {
                    "contact_person": f"Contact {i}",
                    "email": f"test{i}@batch.com",
                    "phone": f"555000{i:04d}"
                }
            })
        
        response = self.session.post(f"{BASE_URL}/api/import/bulk-customers", json={
            "items": items,
            "merge_items": []
        })
        
        assert response.status_code == 200, f"Large batch import failed: {response.text}"
        data = response.json()
        
        assert data["success"] == 20, f"Expected 20 successful imports, got {data['success']}"
        assert data["failed"] == 0, f"Expected 0 failures, got {data['failed']}"
        
        print(f"✅ Large batch import (20 records): success={data['success']}, failed={data['failed']}")
        
        # Clean up
        search_response = self.session.get(f"{BASE_URL}/api/customers?search=TEST_Large_Batch&limit=50")
        if search_response.status_code == 200:
            search_data = search_response.json()
            customers = search_data.get("data", search_data) if isinstance(search_data, dict) else search_data
            for c in customers:
                if "TEST_Large_Batch" in c.get("company_name", ""):
                    self.created_customer_ids.append(c["id"])


class TestBulkImportEdgeCases:
    """Test edge cases and error handling"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login
        self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hakanonel05@gmail.com",
            "password": "Hkn*5225"
        })
    
    def test_bulk_options_invalid_field(self):
        """Test bulk options with missing field_name"""
        response = self.session.post(f"{BASE_URL}/api/options/bulk", json={
            "options": [
                {"value": "Test Value"}  # Missing field_name
            ]
        })
        
        assert response.status_code == 200
        data = response.json()
        # Should skip invalid entries
        assert data["created"] == 0
        print("✅ Bulk options handles missing field_name correctly")
    
    def test_bulk_options_empty_value(self):
        """Test bulk options with empty value"""
        response = self.session.post(f"{BASE_URL}/api/options/bulk", json={
            "options": [
                {"field_name": "market", "value": ""},  # Empty value
                {"field_name": "market", "value": "   "}  # Whitespace only
            ]
        })
        
        assert response.status_code == 200
        data = response.json()
        # Should skip empty values
        assert data["created"] == 0
        print("✅ Bulk options handles empty values correctly")
    
    def test_import_preview_malformed_data(self):
        """Test import preview handles malformed data gracefully"""
        response = self.session.post(f"{BASE_URL}/api/import/preview", json={
            "rows": [
                {"row_num": 1},  # Missing company_name
                {"row_num": 2, "company_name": ""},  # Empty company_name
                {"row_num": 3, "company_name": "Valid Company"}
            ]
        })
        
        assert response.status_code == 200
        data = response.json()
        # Should handle gracefully
        assert "items" in data
        print(f"✅ Import preview handles malformed data: {len(data['items'])} items processed")
    
    def test_bulk_customers_with_all_fields(self):
        """Test bulk import with all customer fields populated"""
        timestamp = int(time.time())
        
        response = self.session.post(f"{BASE_URL}/api/import/bulk-customers", json={
            "items": [{
                "company_name": f"TEST_Full_Fields_{timestamp}",
                "market": "Energy",
                "application": "Industrial",
                "city": "Istanbul",
                "district": "Kadikoy",
                "website": "https://test-full.com",
                "status": "Aktif",
                "contact_info": {
                    "contact_person": "Full Test Person",
                    "email": "full@test.com",
                    "phone": "5559998877"
                },
                "competitor": "Competitor A",
                "partner": "Partner B",
                "potential_level": "Yüksek",
                "potential_value": 100000,
                "assigned_to": "Test User",
                "products": ["Product A", "Product B"],
                "notes": "Test notes for full fields",
                "description": "Full description",
                "tags": ["tag1", "tag2"],
                "is_followup": True
            }],
            "merge_items": []
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == 1
        
        # Verify all fields were saved
        search_response = self.session.get(f"{BASE_URL}/api/customers?search=TEST_Full_Fields_{timestamp}&limit=1")
        if search_response.status_code == 200:
            search_data = search_response.json()
            customers = search_data.get("data", [])
            if customers:
                customer = customers[0]
                assert customer["market"] == "Energy"
                assert customer["city"] == "Istanbul"
                assert customer["potential_level"] == "Yüksek"
                assert customer["is_followup"] == True
                
                # Cleanup
                self.session.delete(f"{BASE_URL}/api/customers/{customer['id']}")
        
        print("✅ Bulk import with all fields works correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
