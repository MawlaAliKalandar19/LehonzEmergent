import requests
import sys
import json
from datetime import datetime
import uuid

class BookVerseAPITester:
    def __init__(self, base_url="https://f2fd0cd3-c740-4e6a-a81d-02cbecb8c8d9.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.user_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_book_id = None
        self.created_user_email = None

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        if files:
            # Remove Content-Type for multipart/form-data
            headers.pop('Content-Type', None)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, data=data, files=files, headers=headers)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                if files:
                    response = requests.put(url, data=data, files=files, headers=headers)
                else:
                    response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and len(str(response_data)) < 500:
                        print(f"   Response: {response_data}")
                    elif isinstance(response_data, list):
                        print(f"   Response: List with {len(response_data)} items")
                except:
                    print(f"   Response: {response.text[:200]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:300]}...")

            return success, response.json() if response.text and response.status_code != 204 else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_admin_login(self):
        """Test admin login and get token"""
        print("\n" + "="*50)
        print("TESTING ADMIN AUTHENTICATION")
        print("="*50)
        
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@bookverse.com", "password": "admin123"}
        )
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            print(f"   Admin token obtained: {self.admin_token[:20]}...")
            return True
        return False

    def test_user_registration_and_login(self):
        """Test user registration and login"""
        print("\n" + "="*50)
        print("TESTING USER REGISTRATION & LOGIN")
        print("="*50)
        
        # Generate unique user email
        timestamp = datetime.now().strftime('%H%M%S')
        self.created_user_email = f"testuser_{timestamp}@bookverse.com"
        
        # Test user registration
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={
                "email": self.created_user_email,
                "password": "testpass123",
                "name": "Test User",
                "role": "user"
            }
        )
        
        if success and 'access_token' in response:
            self.user_token = response['access_token']
            print(f"   User token obtained: {self.user_token[:20]}...")
        
        # Test user login
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={"email": self.created_user_email, "password": "testpass123"}
        )
        
        return success

    def test_auth_me_endpoints(self):
        """Test /auth/me endpoints for both admin and user"""
        print("\n" + "="*50)
        print("TESTING AUTH/ME ENDPOINTS")
        print("="*50)
        
        # Test admin /auth/me
        self.run_test(
            "Admin Auth Me",
            "GET",
            "auth/me",
            200,
            token=self.admin_token
        )
        
        # Test user /auth/me
        self.run_test(
            "User Auth Me",
            "GET",
            "auth/me",
            200,
            token=self.user_token
        )

    def test_books_endpoints(self):
        """Test all book-related endpoints"""
        print("\n" + "="*50)
        print("TESTING BOOKS ENDPOINTS")
        print("="*50)
        
        # Test get all books (public)
        success, response = self.run_test(
            "Get All Books",
            "GET",
            "books",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} books")
        
        # Test get books with filters
        self.run_test(
            "Get Books - Category Filter",
            "GET",
            "books?category=Poetry",
            200
        )
        
        self.run_test(
            "Get Books - Featured Filter",
            "GET",
            "books?featured=true",
            200
        )
        
        self.run_test(
            "Get Books - Search Filter",
            "GET",
            "books?search=milk",
            200
        )

    def test_categories_endpoint(self):
        """Test categories endpoint"""
        print("\n" + "="*50)
        print("TESTING CATEGORIES ENDPOINT")
        print("="*50)
        
        success, response = self.run_test(
            "Get Categories",
            "GET",
            "categories",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found categories: {response}")

    def test_book_crud_operations(self):
        """Test book CRUD operations (admin only)"""
        print("\n" + "="*50)
        print("TESTING BOOK CRUD OPERATIONS")
        print("="*50)
        
        # Test create book (admin)
        book_data = {
            "title": "Test Book API",
            "author": "Test Author",
            "description": "This is a test book created via API",
            "price": "19.99",
            "category": "Technology",
            "is_featured": "false",
            "cta_button_text": "Buy Test Book"
        }
        
        success, response = self.run_test(
            "Create Book (Admin)",
            "POST",
            "books",
            200,
            data=book_data,
            token=self.admin_token
        )
        
        if success and 'id' in response:
            self.created_book_id = response['id']
            print(f"   Created book ID: {self.created_book_id}")
        
        # Test create book without admin token (should fail)
        self.run_test(
            "Create Book (No Auth) - Should Fail",
            "POST",
            "books",
            401,
            data=book_data
        )
        
        # Test create book with user token (should fail)
        self.run_test(
            "Create Book (User) - Should Fail",
            "POST",
            "books",
            403,
            data=book_data,
            token=self.user_token
        )
        
        if self.created_book_id:
            # Test get single book
            self.run_test(
                "Get Single Book",
                "GET",
                f"books/{self.created_book_id}",
                200
            )
            
            # Test update book (admin)
            update_data = {
                "title": "Updated Test Book",
                "price": "24.99"
            }
            
            self.run_test(
                "Update Book (Admin)",
                "PUT",
                f"books/{self.created_book_id}",
                200,
                data=update_data,
                token=self.admin_token
            )
            
            # Test update book without admin (should fail)
            self.run_test(
                "Update Book (User) - Should Fail",
                "PUT",
                f"books/{self.created_book_id}",
                403,
                data=update_data,
                token=self.user_token
            )
            
            # Test delete book (admin)
            self.run_test(
                "Delete Book (Admin)",
                "DELETE",
                f"books/{self.created_book_id}",
                200,
                token=self.admin_token
            )
            
            # Test get deleted book (should fail)
            self.run_test(
                "Get Deleted Book - Should Fail",
                "GET",
                f"books/{self.created_book_id}",
                404
            )

    def test_unauthorized_access(self):
        """Test unauthorized access scenarios"""
        print("\n" + "="*50)
        print("TESTING UNAUTHORIZED ACCESS")
        print("="*50)
        
        # Test /auth/me without token
        self.run_test(
            "Auth Me (No Token) - Should Fail",
            "GET",
            "auth/me",
            401
        )
        
        # Test admin endpoints with invalid token
        self.run_test(
            "Create Book (Invalid Token) - Should Fail",
            "POST",
            "books",
            401,
            data={"title": "Test", "author": "Test", "description": "Test", "price": "10.00", "category": "Test"},
            token="invalid_token"
        )

    def test_error_handling(self):
        """Test error handling scenarios"""
        print("\n" + "="*50)
        print("TESTING ERROR HANDLING")
        print("="*50)
        
        # Test duplicate user registration
        self.run_test(
            "Duplicate Registration - Should Fail",
            "POST",
            "auth/register",
            400,
            data={
                "email": "admin@bookverse.com",  # Already exists
                "password": "testpass123",
                "name": "Duplicate User",
                "role": "user"
            }
        )
        
        # Test invalid login
        self.run_test(
            "Invalid Login - Should Fail",
            "POST",
            "auth/login",
            401,
            data={"email": "nonexistent@bookverse.com", "password": "wrongpass"}
        )
        
        # Test get non-existent book
        self.run_test(
            "Get Non-existent Book - Should Fail",
            "GET",
            f"books/{str(uuid.uuid4())}",
            404
        )

def main():
    print("🚀 Starting BookVerse Pro API Tests")
    print("="*60)
    
    tester = BookVerseAPITester()
    
    # Run all tests
    try:
        # Authentication tests
        if not tester.test_admin_login():
            print("❌ Admin login failed, stopping tests")
            return 1
        
        if not tester.test_user_registration_and_login():
            print("❌ User registration/login failed")
        
        tester.test_auth_me_endpoints()
        
        # Book and category tests
        tester.test_books_endpoints()
        tester.test_categories_endpoint()
        tester.test_book_crud_operations()
        
        # Security tests
        tester.test_unauthorized_access()
        tester.test_error_handling()
        
    except Exception as e:
        print(f"❌ Test execution failed: {str(e)}")
        return 1
    
    # Print final results
    print("\n" + "="*60)
    print("📊 FINAL TEST RESULTS")
    print("="*60)
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Tests Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())