# CRMaster — Product Requirements Document

## Original Problem Statement
CRMaster, Supabase tabanlı bir CRM uygulamasıdır. Bu oturumlardaki istekler:
1. Sidebar'daki "Yeni Kayıt" butonunu kaldır
2. Demo eklenen 21 müşteriyi sil
3. Müşteriler sayfasındaki göz ikonu, AI butonu ve sağ önizleme panelini kaldır
4. Sidebar'a "Ekip" menüsü ekle (limit olmadan tüm üyeler + üye detay sayfası)
5. Müşteri stat butonu pop-up modal'da müşteri listesi açsın → müşteri detay sayfasına gitsin
6. Geri butonları tarayıcı geçmişini kullansın
7. `visits.visited_by` duplicate isim normalizasyonu (Melih + Melih karaman → Melih Karaman)
8. Dashboard durum dağılımı 1000 limitini aşıp 2699 müşteriyi göstersin
9. Dashboard düzenleme ve silme işlemleri sadece admin (hakanonel05@gmail.com) yetkisinde olsun
10. Kullanıcı yönetimi sayfası çalışsın — kullanıcılara silme/dashboard düzenleme yetkilerini açıp kapatabileyim
11. Müşteri "Potansiyel" alanı: "Potansiyel (k€)" etiketi + sayı + k€ suffix + filtreleme

## Tech Stack
- Frontend: React + React Router + TailwindCSS + shadcn/ui
- Backend: FastAPI (`/app/backend/server.py`)
- DB: Supabase (PostgreSQL)
- Dil: Türkçe (UI)

## Auth & Permissions
- Local email/password + Emergent Google Auth
- Admin: `hakanonel05@gmail.com` (ADMIN_EMAIL constant); rol=admin
- Test admin: `admin.test@crmaster.local` / `Admin1234`
- **Granular permission system** (genişletilebilir):
  - `can_delete` — müşteri/iletişim/ziyaret/çağrı silme
  - `can_edit_dashboard` — dashboard düzenleme modu
  - Admin kullanıcılar her zaman tüm yetkilere sahiptir
  - Kullanıcı bazında JSON dosyada saklanır: `/app/backend/user_permissions.json`

## Key API Endpoints
- `GET /api/team-members` — Ekip üyeleri (paginate)
- `GET /api/team-members/{name}/profile` — Detaylı profil (paginate)
- `GET /api/stats`, `GET /api/stats/distribution` — Pagination ile tüm 2699 müşteri
- `GET /api/auth/me` — Kullanıcı + permissions + is_admin
- `GET /api/users` — Tüm kullanıcılar + effective permissions (admin only)
- `PATCH/PUT /api/users/{id}/role?role=...` veya body `{role:...}` (admin only)
- `GET /api/users/{id}/permissions` — Kullanıcının yetkilerini al
- `PATCH /api/users/{id}/permissions` — Body: `{can_delete: bool, can_edit_dashboard: bool}` (admin only)
- `DELETE /api/customers/{id}`, `/visits/{id}`, `/calls/{id}` — `can_delete` yetkisi gerektirir

## Filter Operators (Customers)
- `equals`, `contains`, `not_equals`
- `greater_than`, `less_than` (sayısal alanlar için, örn. potential_value)
- `is_empty`, `is_not_empty`

## Implemented Sessions

### Feb 2026 — Initial cleanup
- Sidebar "Yeni Kayıt" butonu, 21 demo müşteri, Müşteriler preview paneli kaldırıldı

### Feb 2026 — Team Feature
- `/api/team-members*` endpoint'leri
- `TeamPage.jsx`, `TeamMemberDetailPage.jsx`
- Sidebar "Ekip" linki

### Feb 2026 — Customer Popup & Back Button
- Müşteri stat → shadcn Dialog modal
- Geri butonları `navigate(-1)` ile tarayıcı geçmişi

### Feb 2026 — Pagination & Dedupe
- `fetch_all_rows()` helper (Supabase 1000 limit aşımı)
- `/api/stats`, `/api/stats/distribution`, `/api/team-members*` paginate
- `visits.visited_by` "Melih"/"Melih karaman" → "Melih Karaman" merge
- Dashboard StrictMode fix — distribution effect `cancelled` flag kaldırıldı

### Feb 2026 — Permissions + Potential (k€)
- Permission sistemi: `check_permission(user, key)` helper, JSON dosya tabanlı persistence
- DELETE endpoint'leri `can_delete` ile korundu (customer, contact, visit, call)
- `PATCH /api/users/{id}/permissions` endpoint'i
- `PATCH /api/users/{id}/role` (eski PUT+body ile birlikte query param da destekleniyor)
- `useAuth` hook'u artık `canDelete`, `canEditDashboard` flag'lerini sunuyor
- Dashboard "Düzenle" butonu `canEditDashboard` ile gizleniyor
- Customers/CustomerDetail "Sil" butonları `canDelete` ile gizleniyor
- UsersPage tamamen yeniden yazıldı: Silme + Dashboard Düzenleme toggle sütunları (Switch), rol değişimi, kullanıcı silme
- CustomerEditModal: "Potansiyel (k€)" label + sayı input + k€ suffix
- CustomerDetailPage: "Potansiyel (k€)" başlığı + "{value} k€" formatı
- Customers tablosu: "Potansiyel Seviye" + yeni "Potansiyel (k€)" sütunu yan yana
- FilterPanel: `potential_value` field (type=number) + `greater_than`/`less_than` operatörleri
- Backend filter logic: `greater_than`/`less_than` için float karşılaştırma

## Backlog / Future Tasks

### P0 — Make Team Member Names Clickable Everywhere
- Dashboard "Takip Eden Dağılımı" segmentleri
- Müşteriler tablosu "Takip Eden" sütunu (currently text)
- Recent Activities feed kullanıcı adı
- CustomerDetail page `assigned_to` alanı
→ Hepsi `/team/:name` rotasına yönlendirmeli.

### P1 — Quality of Life
- Ekip sayfasında tarih aralığı filtresi (7/30/90 gün)
- Müşteri pop-up modal'ından CSV export
- "Yeni Müşteri" formuna potential_value validation (0–10000 k€)
- FilterPanel'e data-testid'ler (E2E testing için)

### P2 — Performance & Scalability
- `/api/filters/{id}/apply` şu an müşterileri Python'da filtreliyor; potential_value gibi sayısal filtreleri Supabase query'sine pushdown yap (>50k satırda gerekli)
- Customers.jsx 2100+ satır — FilterPanel'i ayrı dosyaya çıkar

### P3 — Permission Hardening
- Yeni granüler izinler: `can_export`, `can_bulk_update`, `can_assign_customer`
- Audit log: yetki değişikliklerini activity_log'a yaz
- `matches_condition` `None` değerleri `less_than` için exclude'lasın (şu an 0 olarak değerlendiriliyor)

## File Map
- `/app/backend/server.py` — Tüm API + check_permission + fetch_all_rows
- `/app/backend/user_permissions.json` — Kullanıcı bazında yetki persistence
- `/app/backend/sessions.json` — Oturum persistence
- `/app/frontend/src/App.js` — useAuth → canDelete, canEditDashboard
- `/app/frontend/src/components/Layout.jsx` — Sidebar
- `/app/frontend/src/pages/Dashboard.jsx` — canEditDashboard ile Düzenle butonu
- `/app/frontend/src/pages/UsersPage.jsx` — Yeniden yazıldı, Switch toggles
- `/app/frontend/src/pages/Customers.jsx` — Potansiyel (k€) sütunu + filtre
- `/app/frontend/src/components/CustomerEditModal.jsx` — k€ suffix input
- `/app/frontend/src/pages/CustomerDetailPage.jsx` — k€ formatı + canDelete kontrol
- `/app/frontend/src/pages/TeamPage.jsx`, `TeamMemberDetailPage.jsx`
- `/app/backend/tests/test_permissions_and_potential.py` — pytest regression
