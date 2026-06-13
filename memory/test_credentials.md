# Test Credentials

## Admin Test User (use this for testing)
- Email: admin.test@crmaster.local
- Password: Admin1234
- Role: admin (promoted manually)
- Auth Type: local (email/password)

Login flow:
1. Go to https://run-hub-11.preview.emergentagent.com/login
2. Use email/password form (not Google)
3. Email: admin.test@crmaster.local
4. Password: Admin1234

## Notes
- Real admin email is hakanonel05@gmail.com (do NOT change his password)
- Admin role is checked by email OR role==admin in check_admin_permission
- Sessions are now persisted to /app/backend/sessions.json on disk
