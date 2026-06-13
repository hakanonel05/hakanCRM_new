# Test Credentials

## Super Admin (yalnızca Kullanıcı Yönetimi sayfasına erişebilir)
- Email: hakanonel05@gmail.com
- Role: admin (ADMIN_EMAIL constant)
- is_super_admin: true (hardcoded by email)
- do NOT change his password

## Admin Test User (use this for testing)
- Email: admin.test@crmaster.local
- Password: Admin1234
- Role: admin (promoted manually)
- Auth Type: local (email/password)
- is_admin: true → can_delete + can_edit_dashboard otomatik açık
- is_super_admin: **false** → Kullanıcı Yönetimi sayfasını göremez (404/Yetkisiz Erişim)

Login flow:
1. Go to https://button-consolidation.preview.emergentagent.com/login
2. Use email/password form (not Google)
3. Email: admin.test@crmaster.local
4. Password: Admin1234

## Test Non-Admin Users (for permission testing)
- fuurkannn354@gmail.com (Furkan ÇELİK) — role=user, no permissions
- mlhkrmn22@gmail.com (Melih Karaman) — role=user, no permissions

## Notes
- Admin role checked via check_admin_permission(user): role==admin OR email==hakanonel05@gmail.com
- Super admin checked via check_super_admin(user): email==hakanonel05@gmail.com (ROLE IS IGNORED)
- check_permission(user, "can_delete"|"can_edit_dashboard"): admin OR per-user toggle
- Per-user permissions persisted in /app/backend/user_permissions.json
- Sessions persisted in /app/backend/sessions.json
- admin.test@crmaster.local was added to allowed_users whitelist during this session
