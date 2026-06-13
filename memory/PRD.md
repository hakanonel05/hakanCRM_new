# CRMaster — Product Requirements Document

## Original Problem Statement
CRMaster, Supabase tabanlı bir CRM uygulamasıdır. Bu oturumlardaki istekler:
1. Sidebar'daki "Yeni Kayıt" butonunu kaldır
2. Demo eklenen 21 müşteriyi sil
3. Müşteriler sayfasındaki göz ikonu, AI butonu ve sağ önizleme panelini kaldır
4. Sidebar'a "Ekip" menüsü ekle. Tüm üyeler limit olmadan gözüksün; tıklayınca detay sayfası (aktiviteler, müşteriler, ziyaretler).
5. Müşteri stat butonuna tıklayınca pop-up modal'da müşteri listesi açılsın; oradan müşteriye tıklayınca müşteri detay sayfasına gitsin.
6. Geri butonları her durumda tarayıcı geçmişini kullanarak önceki sayfaya gitsin.
7. `assigned_to`/`visited_by` alanındaki duplicate isim normalizasyonu.
8. Dashboard'da durum dağılımı 1000'de takılıp 2699 müşteriyi göstermeyi başaramıyordu — limit kaldırılsın.

## Tech Stack
- Frontend: React + React Router + TailwindCSS + shadcn/ui
- Backend: FastAPI (`/app/backend/server.py`)
- DB: Supabase (PostgreSQL)
- Dil: Türkçe (UI)

## Auth
- Local email/password + Emergent Google Auth
- Test admin: `admin.test@crmaster.local` / `Admin1234`
- Gerçek admin: `hakanonel05@gmail.com`

## Key API Endpoints (Ekip + Stats)
- `GET /api/team-members` — Tüm ekip üyelerinin özet stats listesi (pagination ile tüm DB)
- `GET /api/team-members/{name}/profile` — Detaylı profil (pagination ile tüm müşteriler)
- `GET /api/stats` — Toplam ve dağılım istatistikleri (pagination ile 2699 müşteri)
- `GET /api/stats/distribution?field=&followup_only=&limit=` — Dashboard donut/bar grafik verileri

## Implemented in This Session

### Feb 2026 — Initial cleanup
- Sidebar "Yeni Kayıt" butonu kaldırıldı (`Layout.jsx`)
- 21 demo müşteri silindi
- Müşteriler sayfası: göz ikonu, AI sparkles butonu ve sağ önizleme paneli kaldırıldı

### Feb 2026 — Team Feature
- Backend `/api/team-members` ve `/api/team-members/{name}/profile` endpoint'leri
- `TeamPage.jsx` (kart grid, arama, sıralama, toplam stats)
- `TeamMemberDetailPage.jsx` (özet, 30 günlük trend, durum/market/şehir dağılımı, aktivite/müşteri/ziyaret tabları)
- `App.js` rotaları: `/team` ve `/team/:name`
- Sidebar'a "Ekip" linki (`UsersRound` ikonu)

### Feb 2026 — Customer Popup & Back Button
- Team kartlarındaki "Müşteri" stat'ı tıklanabilir buton → shadcn Dialog modal'da müşteri listesi (arama dahil)
- Modal'daki müşteriye tıklayınca `/customers/:id` sayfasına navigasyon
- `TeamMemberDetailPage` ve `CustomerDetailPage` geri butonları artık `navigate(-1)` (tarayıcı geçmişi)

### Feb 2026 — Pagination & Dedupe
- Backend'e `fetch_all_rows()` helper'ı eklendi (Supabase 1000 row default limit'ini aşar)
- `/api/stats`, `/api/stats/distribution`, `/api/team-members`, `/api/team-members/{name}/profile` artık paginate ediyor → 2699 müşteri tam görünüyor
- `visits.visited_by` normalizasyonu: `Melih` ve `Melih karaman` → `Melih Karaman` (5 ziyaret tek isim altında)
- Dashboard StrictMode bug fix: Distribution effect'inde `cancelled` flag kaldırıldı (StrictMode cleanup fetch yanıtlarını yutuyordu, grafikler "Yükleniyor..." takılıyordu)

## Backlog / Future Tasks

### P0 — Make Team Member Names Clickable Everywhere
- Dashboard "Takip Eden Dağılımı" çubuk grafik segmentleri
- Müşteriler tablosu "Takip Eden" sütunu
- Recent Activities feed kullanıcı adı
- Customer Detail page `assigned_to` alanı
→ Hepsi `/team/:name` rotasına yönlendirmeli.

### P1 — Quality of Life
- Ekip sayfasında tarih aralığı filtresi (7/30/90 gün)
- Ekip karşılaştırma görünümü
- Müşteri modal'ından CSV export

### P2 — Data Hygiene
- `customers.assigned_to` ile `visits.visited_by` arasında alfabetik tutarlılık kontrolü (otomatik trigger)

## File Map
- `/app/backend/server.py` — Tüm API endpoint'leri + `fetch_all_rows` helper
- `/app/frontend/src/App.js` — Rotalar
- `/app/frontend/src/components/Layout.jsx` — Sidebar navigation ("Ekip" link)
- `/app/frontend/src/pages/Dashboard.jsx` — StrictMode-safe distribution effect
- `/app/frontend/src/pages/TeamPage.jsx` — Ekip listesi + müşteri pop-up modal
- `/app/frontend/src/pages/TeamMemberDetailPage.jsx` — Ekip üyesi detay (geri butonu `navigate(-1)`)
- `/app/frontend/src/pages/CustomerDetailPage.jsx` — Geri butonu `navigate(-1)`
- `/app/frontend/src/pages/Customers.jsx` — Preview paneli kaldırıldı
