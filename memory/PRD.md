# CRMaster — Product Requirements Document

## Original Problem Statement
CRMaster, Supabase tabanlı bir CRM uygulamasıdır. Bu oturumdaki istekler:
1. Sidebar'daki "Yeni Kayıt" butonunu kaldır
2. Demo eklenen 21 müşteriyi sil
3. Müşteriler sayfasındaki göz ikonu, AI butonu ve sağ önizleme panelini kaldır
4. Sidebar'a "Ekip" menüsü ekle. Ekip sayfasında tüm üyeler (limit yok — "4 olmasın. 5 olmasın") gözüksün; bir üyeye tıklayınca yaptığı tüm aktiviteler, takip ettiği müşteriler, ziyaretler vb. detayları görülsün.

## Tech Stack
- Frontend: React + React Router + TailwindCSS + shadcn/ui
- Backend: FastAPI (`/app/backend/server.py`)
- DB: Supabase (PostgreSQL)
- Dil: Türkçe (UI)

## Auth
- Local email/password + Emergent Google Auth
- Test admin: `admin.test@crmaster.local` / `Admin1234`
- Gerçek admin: `hakanonel05@gmail.com`

## Key API Endpoints (Ekip ile ilgili)
- `GET /api/team-members` → Tüm ekip üyelerinin özet stats listesi
- `GET /api/team-members/{name}/profile?days=30&activity_limit=200` → Detaylı profil (summary, status/market/city dağılımı, aktivite trendi, aktiviteler, ziyaretler, müşteriler)

## Implemented in This Session (Feb 2026)
- [x] Sidebar "Yeni Kayıt" butonu kaldırıldı (`Layout.jsx`)
- [x] 21 demo müşteri silindi (Supabase üzerinden Python script ile)
- [x] Müşteriler sayfası: göz ikonu, AI sparkles butonu ve sağ önizleme paneli kaldırıldı (`Customers.jsx`)
- [x] Backend `/api/team-members` ve `/api/team-members/{name}/profile` endpoint'leri eklendi (`server.py`)
- [x] `TeamPage.jsx` (kart grid, arama, sıralama, toplam stats) oluşturuldu
- [x] `TeamMemberDetailPage.jsx` (özet kartlar, 30 günlük trend, durum/market/şehir dağılımı, aktivite/müşteri/ziyaret tabları) oluşturuldu
- [x] `App.js` rotaları: `/team` ve `/team/:name`
- [x] Sidebar'a "Ekip" linki eklendi (`UsersRound` ikonu)
- [x] Smoke test ekran görüntüleri ile doğrulandı — 7 üye listeleniyor, detay sayfası çalışıyor

## Backlog / Future Tasks

### P0 — Make Team Member Names Clickable Everywhere
- Dashboard pasta grafik (assigned_to bazlı)
- Müşteriler tablosu "Takip Eden" sütunu
- Recent Activities feed kullanıcı adı
- Customer Detail page `assigned_to` alanı
Hepsi `/team/:name` rotasına yönlendirmeli.

### P1 — Data Quality
- `customers.assigned_to` alanında duplicate isimler var ("Melih Karaman" vs "Melih" vs "Melih karaman"). Normalizasyon/merge UI'ı veya admin tool.

### P2 — Team Page Enhancements
- Tarih aralığı filtresi (son 7/30/90 gün)
- Ekip üyeleri arası karşılaştırma görünümü
- CSV export

## File Map
- `/app/backend/server.py` — Tüm API endpoint'leri (Team endpoint'leri dahil)
- `/app/frontend/src/App.js` — Rotalar
- `/app/frontend/src/components/Layout.jsx` — Sidebar navigation
- `/app/frontend/src/pages/TeamPage.jsx` — Ekip listesi
- `/app/frontend/src/pages/TeamMemberDetailPage.jsx` — Ekip üyesi detay
- `/app/frontend/src/pages/Customers.jsx` — Müşteriler tablosu (preview panel kaldırıldı)
