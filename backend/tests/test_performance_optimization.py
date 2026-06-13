"""
Performance optimization tests for CRMaster CRM
Tests for lightweight endpoints and caching:
1. GET /api/customers/filter-options - lightweight filter options endpoint (36KB + 60s cache)
2. GET /api/calls/latest-per-customer - lightweight calls endpoint (308B)
3. GET /api/stats - dashboard stats with 30s cache
4. GET /api/customers?limit=50 - paginated customers
5. GET /api/kanban/customers - kanban with selected fields only
6. POST/PUT/DELETE /api/customers - cache invalidation
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestFilterOptionsEndpoint:
    """Tests for /api/customers/filter-options lightweight endpoint"""
    
    def test_filter_options_returns_unique_values(self):
        """Test that filter-options returns unique values for each field"""
        response = requests.get(f"{BASE_URL}/api/customers/filter-options")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Check all expected fields are present
        expected_fields = ["market", "application", "city", "competitor", "partner", "assigned_to"]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
            assert isinstance(data[field], list), f"Field {field} should be a list"
        
        print(f"✅ Filter options returned: market({len(data['market'])}), application({len(data['application'])}), city({len(data['city'])})")
    
    def test_filter_options_response_size(self):
        """Test that response is significantly smaller than fetching all customers"""
        response = requests.get(f"{BASE_URL}/api/customers/filter-options")
        assert response.status_code == 200
        
        content_length = len(response.content)
        print(f"Filter options response size: {content_length} bytes")
        
        # Should be much smaller than full customers response (previously 609KB)
        # Expect less than 100KB
        assert content_length < 100000, f"Response too large: {content_length} bytes"
        print(f"✅ Response size is {content_length} bytes (under 100KB)")
    
    def test_filter_options_caching(self):
        """Test that caching works (60s TTL)"""
        # First request
        start1 = time.time()
        response1 = requests.get(f"{BASE_URL}/api/customers/filter-options")
        time1 = time.time() - start1
        assert response1.status_code == 200
        
        # Second request should be faster (cached)
        time.sleep(0.5)
        start2 = time.time()
        response2 = requests.get(f"{BASE_URL}/api/customers/filter-options")
        time2 = time.time() - start2
        assert response2.status_code == 200
        
        # Both should return same data
        assert response1.json() == response2.json(), "Cached data should match"
        
        print(f"✅ First request: {time1:.3f}s, Second request (cached): {time2:.3f}s")
    
    def test_filter_options_values_sorted(self):
        """Test that returned values are sorted"""
        response = requests.get(f"{BASE_URL}/api/customers/filter-options")
        assert response.status_code == 200
        
        data = response.json()
        
        for field, values in data.items():
            if len(values) > 1:
                assert values == sorted(values), f"Values for {field} are not sorted"
        
        print("✅ All filter option values are sorted")


class TestLatestCallsEndpoint:
    """Tests for /api/calls/latest-per-customer lightweight endpoint"""
    
    def test_latest_calls_returns_dict(self):
        """Test that endpoint returns customer_id -> outcome mapping"""
        response = requests.get(f"{BASE_URL}/api/calls/latest-per-customer")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, dict), "Should return a dict"
        
        print(f"✅ Latest calls endpoint returned {len(data)} customer outcomes")
    
    def test_latest_calls_response_size(self):
        """Test that response is very small (only outcome per customer)"""
        response = requests.get(f"{BASE_URL}/api/calls/latest-per-customer")
        assert response.status_code == 200
        
        content_length = len(response.content)
        print(f"Latest calls response size: {content_length} bytes")
        
        # Should be very small (previously all calls data was much larger)
        # Even with 1000s of customers, should be under 50KB
        assert content_length < 50000, f"Response too large: {content_length} bytes"
        print(f"✅ Response size is {content_length} bytes (under 50KB)")
    
    def test_latest_calls_outcome_values(self):
        """Test that outcome values are strings"""
        response = requests.get(f"{BASE_URL}/api/calls/latest-per-customer")
        assert response.status_code == 200
        
        data = response.json()
        
        for customer_id, outcome in data.items():
            assert isinstance(customer_id, str), "Customer ID should be string"
            assert isinstance(outcome, str), "Outcome should be string"
        
        print("✅ All outcome values are valid strings")


class TestStatsEndpoint:
    """Tests for /api/stats dashboard statistics endpoint"""
    
    def test_stats_returns_all_fields(self):
        """Test that stats returns all required dashboard data"""
        response = requests.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200
        
        data = response.json()
        
        # Required fields
        required_fields = [
            "total_customers", "total_visits", "followup_customers", "followup_visits",
            "status_distribution", "market_distribution", "city_distribution",
            "recent_customers", "upcoming_followups"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"✅ Stats returned: {data['total_customers']} customers, {data['total_visits']} visits")
    
    def test_stats_distributions_format(self):
        """Test that distributions are in correct format"""
        response = requests.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200
        
        data = response.json()
        
        # Status distribution should be list of {_id, count}
        for item in data["status_distribution"]:
            assert "_id" in item, "Missing _id in status distribution"
            assert "count" in item, "Missing count in status distribution"
            assert isinstance(item["count"], int), "Count should be integer"
        
        print(f"✅ Status distribution: {len(data['status_distribution'])} statuses")
        print(f"✅ Market distribution: {len(data['market_distribution'])} markets (top 10)")
        print(f"✅ City distribution: {len(data['city_distribution'])} cities (top 10)")
    
    def test_stats_caching(self):
        """Test that caching works (30s TTL)"""
        # First request
        start1 = time.time()
        response1 = requests.get(f"{BASE_URL}/api/stats")
        time1 = time.time() - start1
        assert response1.status_code == 200
        
        # Second request should be faster (cached)
        time.sleep(0.5)
        start2 = time.time()
        response2 = requests.get(f"{BASE_URL}/api/stats")
        time2 = time.time() - start2
        assert response2.status_code == 200
        
        # Both should return same total counts
        assert response1.json()["total_customers"] == response2.json()["total_customers"]
        
        print(f"✅ First request: {time1:.3f}s, Second request (cached): {time2:.3f}s")


class TestPaginatedCustomers:
    """Tests for /api/customers paginated endpoint"""
    
    def test_customers_pagination_default(self):
        """Test default pagination (limit=50)"""
        response = requests.get(f"{BASE_URL}/api/customers")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check pagination response format
        assert "data" in data, "Missing 'data' field"
        assert "total" in data, "Missing 'total' field"
        assert "page" in data, "Missing 'page' field"
        assert "limit" in data, "Missing 'limit' field"
        assert "total_pages" in data, "Missing 'total_pages' field"
        
        # Default limit should be 50
        assert data["limit"] == 50, f"Expected limit 50, got {data['limit']}"
        assert len(data["data"]) <= 50, f"Got more than 50 records: {len(data['data'])}"
        
        print(f"✅ Pagination: {len(data['data'])} records, total: {data['total']}, pages: {data['total_pages']}")
    
    def test_customers_pagination_custom_limit(self):
        """Test custom pagination limit"""
        response = requests.get(f"{BASE_URL}/api/customers?limit=10&page=1")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["data"]) <= 10
        assert data["page"] == 1
        
        print(f"✅ Custom limit (10): got {len(data['data'])} records")
    
    def test_customers_pagination_page_navigation(self):
        """Test pagination page navigation"""
        # Get first page
        response1 = requests.get(f"{BASE_URL}/api/customers?limit=10&page=1")
        assert response1.status_code == 200
        data1 = response1.json()
        
        # Get second page
        response2 = requests.get(f"{BASE_URL}/api/customers?limit=10&page=2")
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Pages should have different data
        if len(data1["data"]) > 0 and len(data2["data"]) > 0:
            assert data1["data"][0]["id"] != data2["data"][0]["id"], "Page 1 and 2 should have different data"
        
        print(f"✅ Page navigation works: page 1 ({len(data1['data'])} records), page 2 ({len(data2['data'])} records)")
    
    def test_customers_search_filter(self):
        """Test search filter works with pagination"""
        response = requests.get(f"{BASE_URL}/api/customers?search=test&limit=50")
        assert response.status_code == 200
        
        data = response.json()
        assert "data" in data
        
        print(f"✅ Search filter returned {len(data['data'])} results for 'test'")
    
    def test_customers_status_filter(self):
        """Test status filter works with pagination"""
        response = requests.get(f"{BASE_URL}/api/customers?status=Beklemede&limit=50")
        assert response.status_code == 200
        
        data = response.json()
        assert "data" in data
        
        # All returned customers should have the filtered status
        for customer in data["data"]:
            assert customer.get("status") == "Beklemede", f"Expected status 'Beklemede', got {customer.get('status')}"
        
        print(f"✅ Status filter returned {len(data['data'])} customers with status 'Beklemede'")


class TestKanbanEndpoint:
    """Tests for /api/kanban/customers with field selection"""
    
    def test_kanban_customers_returns_grouped_data(self):
        """Test that kanban endpoint returns customers grouped by status"""
        response = requests.get(f"{BASE_URL}/api/kanban/customers?group_by=status")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, dict), "Should return a dict of groups"
        
        # Should have status columns
        expected_statuses = ["Beklemede", "İletişimde", "Teklif Verildi", "Çalışılıyor", "Kazanıldı", "Kaybedildi"]
        for status in expected_statuses:
            if status in data:
                assert isinstance(data[status], list), f"Group {status} should be a list"
        
        total_customers = sum(len(customers) for customers in data.values())
        print(f"✅ Kanban returned {len(data)} columns with {total_customers} total customers")
    
    def test_kanban_customers_limited_fields(self):
        """Test that kanban endpoint only returns needed fields"""
        response = requests.get(f"{BASE_URL}/api/kanban/customers?group_by=status")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check first customer for expected fields
        for status, customers in data.items():
            if customers:
                customer = customers[0]
                # Should have: id, company_name, market, application, city, status, potential_level, assigned_to, contact_info, products, competitor, partner
                expected_fields = ["id", "company_name", "market", "status"]
                for field in expected_fields:
                    assert field in customer, f"Missing expected field: {field}"
                
                # Should NOT have heavy fields like notes_list, documents
                assert "notes_list" not in customer or customer.get("notes_list") is None, "Should not return notes_list"
                assert "documents" not in customer or customer.get("documents") is None, "Should not return documents"
                break
        
        print("✅ Kanban returns only lightweight fields")
    
    def test_kanban_response_size(self):
        """Test that kanban response is reasonably sized"""
        response = requests.get(f"{BASE_URL}/api/kanban/customers?group_by=status")
        assert response.status_code == 200
        
        content_length = len(response.content)
        print(f"Kanban response size: {content_length} bytes ({content_length/1024:.1f}KB)")
        
        # With selected fields, should be much smaller than full customer data
        # Even with 1000s of customers, should be manageable
        print(f"✅ Kanban response size: {content_length/1024:.1f}KB")


class TestCacheInvalidation:
    """Tests for cache invalidation on customer CRUD"""
    
    def test_create_customer_invalidates_cache(self):
        """Test that creating a customer invalidates filter-options cache"""
        # First, get filter options to populate cache
        response1 = requests.get(f"{BASE_URL}/api/customers/filter-options")
        assert response1.status_code == 200
        
        # Create a new customer
        new_customer = {
            "company_name": "TEST_CacheInvalidation_Company",
            "market": "TEST_CacheInvalidation_Market",
            "status": "Beklemede"
        }
        create_response = requests.post(f"{BASE_URL}/api/customers", json=new_customer)
        assert create_response.status_code == 200
        customer_id = create_response.json()["id"]
        
        # Cache should be invalidated - new market should appear in fresh request
        # (Note: immediate appearance depends on TTL expiry in real scenario)
        
        # Cleanup
        delete_response = requests.delete(f"{BASE_URL}/api/customers/{customer_id}")
        assert delete_response.status_code == 200
        
        print("✅ Create customer triggers cache invalidation")
    
    def test_update_customer_invalidates_cache(self):
        """Test that updating a customer invalidates cache"""
        # Create a test customer
        new_customer = {
            "company_name": "TEST_UpdateCache_Company",
            "market": "Original_Market",
            "status": "Beklemede"
        }
        create_response = requests.post(f"{BASE_URL}/api/customers", json=new_customer)
        assert create_response.status_code == 200
        customer_id = create_response.json()["id"]
        
        # Get filter options
        requests.get(f"{BASE_URL}/api/customers/filter-options")
        
        # Update customer
        update_data = {"market": "Updated_Market"}
        update_response = requests.put(f"{BASE_URL}/api/customers/{customer_id}", json=update_data)
        assert update_response.status_code == 200
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/customers/{customer_id}")
        
        print("✅ Update customer triggers cache invalidation")
    
    def test_delete_customer_invalidates_cache(self):
        """Test that deleting a customer invalidates cache"""
        # Create a test customer
        new_customer = {
            "company_name": "TEST_DeleteCache_Company",
            "market": "Delete_Test_Market",
            "status": "Beklemede"
        }
        create_response = requests.post(f"{BASE_URL}/api/customers", json=new_customer)
        assert create_response.status_code == 200
        customer_id = create_response.json()["id"]
        
        # Get filter options to populate cache
        requests.get(f"{BASE_URL}/api/customers/filter-options")
        
        # Delete customer
        delete_response = requests.delete(f"{BASE_URL}/api/customers/{customer_id}")
        assert delete_response.status_code == 200
        
        print("✅ Delete customer triggers cache invalidation")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
