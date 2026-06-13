import requests
import sys
import json
from datetime import datetime, timedelta
import uuid

class CRMAPITester:
    def __init__(self, base_url="https://run-hub-11.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.created_customer_id = None
        self.created_visit_id = None

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)
            elif method == 'PATCH':
                response = requests.patch(url, headers=headers, params=params)

            success = response.status_code == expected_status
            if success:
                self.log_test(name, True)
                try:
                    return response.json() if response.content else {}
                except:
                    return {}
            else:
                self.log_test(name, False, f"Expected {expected_status}, got {response.status_code}")
                return None

        except Exception as e:
            self.log_test(name, False, f"Error: {str(e)}")
            return None

    def test_root_endpoint(self):
        """Test root API endpoint"""
        result = self.run_test("Root API", "GET", "", 200)
        return result is not None

    def test_stats_endpoint(self):
        """Test dashboard stats endpoint"""
        result = self.run_test("Dashboard Stats", "GET", "stats", 200)
        if result:
            required_fields = ["total_customers", "total_visits", "followup_customers", "followup_visits"]
            for field in required_fields:
                if field not in result:
                    self.log_test(f"Stats field {field}", False, "Missing field")
                    return False
                else:
                    self.log_test(f"Stats field {field}", True)
        return result is not None

    def test_customer_crud(self):
        """Test customer CRUD operations"""
        # Test create customer
        customer_data = {
            "company_name": f"Test Company {datetime.now().strftime('%H%M%S')}",
            "market": "Test Market",
            "application": "Test Application",
            "city": "Istanbul",
            "district": "Kadikoy",
            "website": "https://test.com",
            "status": "Beklemede",
            "contact_info": {
                "contact_person": "Test Person",
                "email": "test@test.com",
                "phone": "+90 555 555 55 55"
            },
            "potential_value": 10000,
            "next_followup_date": (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d'),
            "assigned_to": "Test User",
            "competitor": "Test Competitor",
            "partner": "Test Partner",
            "potential_level": "Yüksek",
            "products": ["ACS580", "PLC"],
            "description": "Test description",
            "notes": "Test notes",
            "tags": ["test", "automation"],
            "is_followup": False
        }
        
        result = self.run_test("Create Customer", "POST", "customers", 200, customer_data)
        if result and "id" in result:
            self.created_customer_id = result["id"]
            
            # Test get customer
            get_result = self.run_test("Get Customer", "GET", f"customers/{self.created_customer_id}", 200)
            if get_result:
                # Verify data integrity
                if get_result.get("company_name") == customer_data["company_name"]:
                    self.log_test("Customer Data Integrity", True)
                else:
                    self.log_test("Customer Data Integrity", False, "Data mismatch")
            
            # Test update customer
            update_data = {
                "company_name": customer_data["company_name"] + " Updated",
                "status": "Çalışılıyor"
            }
            update_result = self.run_test("Update Customer", "PUT", f"customers/{self.created_customer_id}", 200, update_data)
            
            # Test toggle followup
            followup_result = self.run_test("Toggle Customer Followup", "PATCH", f"customers/{self.created_customer_id}/followup", 200, params={"is_followup": "true"})
            
            return True
        return False

    def test_customer_similarity(self):
        """Test customer similarity checking"""
        if not self.created_customer_id:
            self.log_test("Customer Similarity Check", False, "No customer created")
            return False
            
        similarity_data = {
            "company_name": "Test Company Similar",
            "contact_info": {
                "phone": "+90 555 555 55 55"  # Same phone as created customer
            }
        }
        
        result = self.run_test("Check Customer Similarity", "POST", "customers/check-similarity", 200, similarity_data)
        return result is not None

    def test_customer_list_and_filters(self):
        """Test customer listing and filtering"""
        # Test get all customers
        result = self.run_test("Get All Customers", "GET", "customers", 200)
        if result is None:
            return False
            
        # Test search filter
        search_result = self.run_test("Search Customers", "GET", "customers", 200, params={"search": "Test"})
        
        # Test market filter
        market_result = self.run_test("Filter by Market", "GET", "customers", 200, params={"market": "Test Market"})
        
        # Test status filter
        status_result = self.run_test("Filter by Status", "GET", "customers", 200, params={"status": "Beklemede"})
        
        # Test followup filter
        followup_result = self.run_test("Filter by Followup", "GET", "customers", 200, params={"is_followup": "true"})
        
        return True

    def test_visit_crud(self):
        """Test visit CRUD operations"""
        if not self.created_customer_id:
            self.log_test("Visit CRUD", False, "No customer available")
            return False
            
        # Test create visit
        visit_data = {
            "customer_id": self.created_customer_id,
            "visit_date": datetime.now().strftime('%Y-%m-%d'),
            "visit_type": "Yüz Yüze",
            "notes": "Test visit notes",
            "next_visit_date": (datetime.now() + timedelta(days=14)).strftime('%Y-%m-%d'),
            "outcome": "Positive meeting",
            "is_followup": False
        }
        
        result = self.run_test("Create Visit", "POST", "visits", 200, visit_data)
        if result and "id" in result:
            self.created_visit_id = result["id"]
            
            # Test get visit
            get_result = self.run_test("Get Visit", "GET", f"visits/{self.created_visit_id}", 200)
            
            # Test update visit
            update_data = {
                **visit_data,
                "outcome": "Updated outcome"
            }
            update_result = self.run_test("Update Visit", "PUT", f"visits/{self.created_visit_id}", 200, update_data)
            
            # Test toggle visit followup
            followup_result = self.run_test("Toggle Visit Followup", "PATCH", f"visits/{self.created_visit_id}/followup", 200, params={"is_followup": "true"})
            
            return True
        return False

    def test_visit_list_and_filters(self):
        """Test visit listing and filtering"""
        # Test get all visits
        result = self.run_test("Get All Visits", "GET", "visits", 200)
        if result is None:
            return False
            
        # Test customer filter
        if self.created_customer_id:
            customer_result = self.run_test("Filter Visits by Customer", "GET", "visits", 200, params={"customer_id": self.created_customer_id})
        
        # Test followup filter
        followup_result = self.run_test("Filter Visits by Followup", "GET", "visits", 200, params={"is_followup": "true"})
        
        return True

    def test_dynamic_options(self):
        """Test dynamic options system"""
        # Test create option
        option_data = {
            "id": str(uuid.uuid4()),
            "field_name": "market",
            "value": "Test Dynamic Market",
            "color": "#ff0000"
        }
        
        result = self.run_test("Create Dynamic Option", "POST", "options", 200, option_data)
        if result:
            # Test get options by field
            field_result = self.run_test("Get Options by Field", "GET", "options/market", 200)
            
            # Test get all options
            all_result = self.run_test("Get All Options", "GET", "options", 200)
            
            return True
        return False

    def test_followups(self):
        """Test followup endpoints"""
        result = self.run_test("Get Followups", "GET", "followups", 200)
        if result:
            # Check structure
            if "customers" in result and "visits" in result:
                self.log_test("Followups Structure", True)
            else:
                self.log_test("Followups Structure", False, "Missing customers or visits")
        return result is not None

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        # Test auth/me endpoint (should return 401 without authentication)
        result = self.run_test("Auth Me (Unauthenticated)", "GET", "auth/me", 401)
        
        # Test auth/session endpoint structure (should return 400 without session_id)
        result = self.run_test("Auth Session (No Data)", "POST", "auth/session", 400)
        
        # Test auth/logout endpoint
        result = self.run_test("Auth Logout", "POST", "auth/logout", 200)
        
        return True

    def test_xlsx_export_endpoints(self):
        """Test XLSX export endpoints"""
        # Test customer XLSX export
        try:
            response = requests.get(f"{self.base_url}/export/customers/xlsx")
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                if 'spreadsheet' in content_type or 'xlsx' in content_type:
                    self.log_test("Export Customers XLSX", True)
                else:
                    self.log_test("Export Customers XLSX", False, f"Wrong content type: {content_type}")
            else:
                self.log_test("Export Customers XLSX", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Export Customers XLSX", False, f"Error: {str(e)}")
        
        # Test customer template download
        try:
            response = requests.get(f"{self.base_url}/export/customers/template")
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                if 'spreadsheet' in content_type or 'xlsx' in content_type:
                    self.log_test("Download Customer Template", True)
                else:
                    self.log_test("Download Customer Template", False, f"Wrong content type: {content_type}")
            else:
                self.log_test("Download Customer Template", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Download Customer Template", False, f"Error: {str(e)}")
        
        # Test visit template download
        try:
            response = requests.get(f"{self.base_url}/export/visits/template")
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                if 'spreadsheet' in content_type or 'xlsx' in content_type:
                    self.log_test("Download Visit Template", True)
                else:
                    self.log_test("Download Visit Template", False, f"Wrong content type: {content_type}")
            else:
                self.log_test("Download Visit Template", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Download Visit Template", False, f"Error: {str(e)}")
        
        return True

    def test_cleanup(self):
        """Clean up test data"""
        success = True
        
        # Delete visit
        if self.created_visit_id:
            result = self.run_test("Delete Visit", "DELETE", f"visits/{self.created_visit_id}", 200)
            if not result:
                success = False
        
        # Delete customer
        if self.created_customer_id:
            result = self.run_test("Delete Customer", "DELETE", f"customers/{self.created_customer_id}", 200)
            if not result:
                success = False
                
        return success

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting CRM API Tests...")
        print(f"Testing against: {self.base_url}")
        print("=" * 50)
        
        # Basic connectivity
        if not self.test_root_endpoint():
            print("❌ Cannot connect to API. Stopping tests.")
            return False
            
        # Dashboard tests
        self.test_stats_endpoint()
        
        # Customer tests
        self.test_customer_crud()
        self.test_customer_similarity()
        self.test_customer_list_and_filters()
        
        # Visit tests
        self.test_visit_crud()
        self.test_visit_list_and_filters()
        
        # Dynamic options tests
        self.test_dynamic_options()
        
        # Followup tests
        self.test_followups()
        
        # Auth tests
        self.test_auth_endpoints()
        
        # XLSX export tests
        self.test_xlsx_export_endpoints()
        
        # Cleanup
        self.test_cleanup()
        
        # Print results
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print("⚠️  Some tests failed. Check details above.")
            failed_tests = [t for t in self.test_results if not t["success"]]
            print("\nFailed tests:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']}")
            return False

def main():
    tester = CRMAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())