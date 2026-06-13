"""
Test P2 Features: File Upload and User Management
Tests for CRMaster P2 features including:
- File upload to customer documents
- File download
- File deletion
- User management (list, role change, delete)
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://run-hub-11.preview.emergentagent.com')

# Test session token for admin user
SESSION_TOKEN = "test_session_1767454790549"


class TestFileUpload:
    """File upload endpoint tests"""
    
    def test_upload_file_without_customer(self):
        """Test uploading a file without associating to a customer"""
        # Create a test file
        files = {'file': ('test_file.txt', b'Test content for upload', 'text/plain')}
        
        response = requests.post(f"{BASE_URL}/api/upload", files=files)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "id" in data
        assert "original_name" in data
        assert "stored_name" in data
        assert "url" in data
        assert "size" in data
        assert "content_type" in data
        assert "created_at" in data
        
        # Verify values
        assert data["original_name"] == "test_file.txt"
        assert data["content_type"] == "text/plain"
        assert data["url"].startswith("/api/files/")
        
        # Cleanup - delete the uploaded file
        stored_name = data["stored_name"]
        requests.delete(f"{BASE_URL}/api/files/{stored_name}")
    
    def test_upload_file_with_customer(self):
        """Test uploading a file and associating to a customer"""
        # First get a customer ID
        customers_response = requests.get(f"{BASE_URL}/api/customers")
        assert customers_response.status_code == 200
        customers = customers_response.json()
        assert len(customers) > 0
        
        customer_id = customers[0]["id"]
        
        # Upload file with customer_id
        files = {'file': ('customer_doc.txt', b'Customer document content', 'text/plain')}
        response = requests.post(f"{BASE_URL}/api/upload?customer_id={customer_id}", files=files)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify file was uploaded
        assert data["original_name"] == "customer_doc.txt"
        
        # Verify file was added to customer's documents
        customer_response = requests.get(f"{BASE_URL}/api/customers/{customer_id}")
        assert customer_response.status_code == 200
        customer = customer_response.json()
        
        # Check if document was added
        documents = customer.get("documents", [])
        doc_names = [d["name"] for d in documents]
        assert "customer_doc.txt" in doc_names
        
        # Cleanup
        stored_name = data["stored_name"]
        requests.delete(f"{BASE_URL}/api/files/{stored_name}?customer_id={customer_id}")
    
    def test_upload_empty_filename_fails(self):
        """Test that uploading without a file fails"""
        response = requests.post(f"{BASE_URL}/api/upload")
        assert response.status_code == 422  # Validation error


class TestFileDownload:
    """File download endpoint tests"""
    
    def test_download_existing_file(self):
        """Test downloading an existing file"""
        # First upload a file
        files = {'file': ('download_test.txt', b'Content to download', 'text/plain')}
        upload_response = requests.post(f"{BASE_URL}/api/upload", files=files)
        assert upload_response.status_code == 200
        
        stored_name = upload_response.json()["stored_name"]
        
        # Download the file
        download_response = requests.get(f"{BASE_URL}/api/files/{stored_name}")
        assert download_response.status_code == 200
        assert download_response.content == b'Content to download'
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/files/{stored_name}")
    
    def test_download_nonexistent_file(self):
        """Test downloading a file that doesn't exist"""
        response = requests.get(f"{BASE_URL}/api/files/nonexistent_file.txt")
        assert response.status_code == 404


class TestFileDelete:
    """File deletion endpoint tests"""
    
    def test_delete_file(self):
        """Test deleting an uploaded file"""
        # First upload a file
        files = {'file': ('delete_test.txt', b'Content to delete', 'text/plain')}
        upload_response = requests.post(f"{BASE_URL}/api/upload", files=files)
        assert upload_response.status_code == 200
        
        stored_name = upload_response.json()["stored_name"]
        
        # Delete the file
        delete_response = requests.delete(f"{BASE_URL}/api/files/{stored_name}")
        assert delete_response.status_code == 200
        assert delete_response.json()["message"] == "Dosya silindi"
        
        # Verify file is deleted
        download_response = requests.get(f"{BASE_URL}/api/files/{stored_name}")
        assert download_response.status_code == 404
    
    def test_delete_file_with_customer(self):
        """Test deleting a file removes it from customer's documents"""
        # Get a customer
        customers_response = requests.get(f"{BASE_URL}/api/customers")
        customer_id = customers_response.json()[0]["id"]
        
        # Upload file to customer
        files = {'file': ('customer_delete_test.txt', b'Content', 'text/plain')}
        upload_response = requests.post(f"{BASE_URL}/api/upload?customer_id={customer_id}", files=files)
        stored_name = upload_response.json()["stored_name"]
        
        # Delete with customer_id
        delete_response = requests.delete(f"{BASE_URL}/api/files/{stored_name}?customer_id={customer_id}")
        assert delete_response.status_code == 200
        
        # Verify removed from customer's documents
        customer_response = requests.get(f"{BASE_URL}/api/customers/{customer_id}")
        documents = customer_response.json().get("documents", [])
        stored_names = [d.get("stored_name") for d in documents]
        assert stored_name not in stored_names


class TestUserManagement:
    """User management endpoint tests (admin only)"""
    
    @pytest.fixture
    def admin_session(self):
        """Get admin session headers"""
        return {"Cookie": f"session_token={SESSION_TOKEN}"}
    
    def test_get_users_as_admin(self, admin_session):
        """Test getting all users as admin"""
        response = requests.get(f"{BASE_URL}/api/users", headers=admin_session)
        
        assert response.status_code == 200
        users = response.json()
        
        # Verify response is a list
        assert isinstance(users, list)
        
        # Verify user structure
        if users:
            user = users[0]
            assert "user_id" in user
            assert "email" in user
            assert "name" in user
    
    def test_get_users_without_auth(self):
        """Test getting users without authentication fails"""
        response = requests.get(f"{BASE_URL}/api/users")
        assert response.status_code in [401, 403]  # Either unauthorized or forbidden
    
    def test_change_user_role(self, admin_session):
        """Test changing a user's role"""
        # Get users
        users_response = requests.get(f"{BASE_URL}/api/users", headers=admin_session)
        users = users_response.json()
        
        # Find a non-admin user to change
        test_user = None
        for user in users:
            if user.get("role") == "user" and user.get("email") != "hakanonel05@gmail.com":
                test_user = user
                break
        
        if not test_user:
            pytest.skip("No non-admin user found to test role change")
        
        user_id = test_user["user_id"]
        
        # Change role to admin
        response = requests.patch(
            f"{BASE_URL}/api/users/{user_id}/role?role=admin",
            headers=admin_session
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Rol güncellendi"
        
        # Verify role changed
        users_response = requests.get(f"{BASE_URL}/api/users", headers=admin_session)
        updated_user = next((u for u in users_response.json() if u["user_id"] == user_id), None)
        assert updated_user["role"] == "admin"
        
        # Change back to user
        requests.patch(f"{BASE_URL}/api/users/{user_id}/role?role=user", headers=admin_session)
    
    def test_change_role_invalid_role(self, admin_session):
        """Test changing to invalid role fails"""
        # Get a user
        users_response = requests.get(f"{BASE_URL}/api/users", headers=admin_session)
        user_id = users_response.json()[0]["user_id"]
        
        response = requests.patch(
            f"{BASE_URL}/api/users/{user_id}/role?role=invalid_role",
            headers=admin_session
        )
        assert response.status_code == 400
    
    def test_delete_user(self, admin_session):
        """Test deleting a user"""
        # Create a test user to delete
        import subprocess
        result = subprocess.run([
            "mongosh", "--quiet", "--eval",
            """
            use('test_database');
            var userId = 'test-delete-' + Date.now();
            db.users.insertOne({
                user_id: userId,
                email: 'delete_test@example.com',
                name: 'Delete Test User',
                role: 'user',
                created_at: new Date().toISOString()
            });
            print(userId);
            """
        ], capture_output=True, text=True)
        
        user_id = result.stdout.strip()
        
        if not user_id:
            pytest.skip("Could not create test user")
        
        # Delete the user
        response = requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=admin_session)
        assert response.status_code == 200
        assert response.json()["message"] == "Kullanıcı silindi"
        
        # Verify user is deleted
        users_response = requests.get(f"{BASE_URL}/api/users", headers=admin_session)
        user_ids = [u["user_id"] for u in users_response.json()]
        assert user_id not in user_ids
    
    def test_cannot_delete_self(self, admin_session):
        """Test that admin cannot delete themselves"""
        # Get current user
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_session)
        current_user_id = me_response.json()["user_id"]
        
        # Try to delete self
        response = requests.delete(f"{BASE_URL}/api/users/{current_user_id}", headers=admin_session)
        assert response.status_code == 400
        assert "Kendinizi silemezsiniz" in response.json()["detail"]


class TestAuthEndpoints:
    """Authentication endpoint tests"""
    
    def test_get_current_user(self):
        """Test getting current authenticated user"""
        headers = {"Cookie": f"session_token={SESSION_TOKEN}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert response.status_code == 200
        user = response.json()
        
        assert "user_id" in user
        assert "email" in user
        assert "name" in user
        assert "role" in user
    
    def test_get_current_user_without_auth(self):
        """Test getting current user without authentication fails"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
