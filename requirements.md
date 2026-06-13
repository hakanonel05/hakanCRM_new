# E1 CRM - Müşteri İlişkileri Yönetim Sistemi

## Orijinal Problem Statement
CRM programı oluşturma - Airtable benzeri dinamik tablo ve tag sistemi ile müşteri ve ziyaret yönetimi. Benzer müşteri uyarısı. Follow-up takip sistemi. Google ile giriş. Cloud yedekleme. PWA desteği.

## Veri Depolama
**Tüm müşteri ve ziyaret verileriniz MongoDB veritabanında güvenle saklanır.** Uygulamayı deploy ettiğinizde (Deploy butonuna basarak) **her yerden** internet üzerinden erişebilirsiniz. Veriler bulutta saklandığı için telefon, tablet veya bilgisayardan erişilebilir.

## Tamamlanan Özellikler

### 1. Google ile Giriş (Emergent Auth)
- "Google ile Giriş Yap" butonu
- E1 CRM branding
- Oturum yönetimi (7 gün geçerli)
- Çıkış yapma

### 2. PWA Desteği (Progressive Web App)
- Telefona "Ana Ekrana Ekle" özelliği
- Offline çalışma desteği (Service Worker)
- Uygulama gibi açılma (standalone mode)
- Özel manifest.json

### 3. Dashboard
- Toplam müşteri, ziyaret ve follow-up istatistikleri
- Son eklenen müşteriler listesi
- Yaklaşan takipler listesi
- Durum ve market dağılım grafikleri

### 4. Müşteri Yönetimi (Airtable Benzeri)
- Tablo görünümünde müşteri listesi
- Gelişmiş arama ve filtreleme
- **Müşteri Detay Kartı**: View Visits, Add Visit, Contacts, Edit butonları
- **CreatableSelect**: Airtable gibi yazınca arar, yoksa ekler
- **Renkli Tag'ler**: Her tag farklı renk ile gösteriliyor

### 5. XLSX Desteği (Excel)
- **Backup**: .xlsx formatında müşteri yedeği
- **Şablonlar**: Şirket ve ziyaret import şablonları .xlsx
- **Import**: XLSX ve CSV dosyaları destekleniyor

### 6. Cloud Backup Modal
- "Cloud Yedekleme Nasıl Yapılır?" adımları
- "Yedek Dosyasını İndir (.xlsx)" butonu
- Google Drive ve OneDrive bağlantıları

### 7. İki Aşamalı Import Sistemi
- **Şirket Import**: Benzerlik kontrolü, Yoksay/Ekle seçenekleri
- **Ziyaret Import**: Şirket seçimi sonrası toplu ekleme

### 8. Çoklu Contacts Sistemi
- Müşteriye birden fazla kişi ekleme
- Birincil kişi belirleme

### 9. Dinamik Tag Sistemi
- CreatableSelect ile yazınca ara, yoksa ekle
- Her tag otomatik renk ataması (15 farklı renk)

### 10. Benzerlik Kontrolü
- Firma adı, telefon ve web sitesi karşılaştırması
- %70+ benzerlik uyarısı
- Import sırasında Yoksay/Ekle seçenekleri

### 11. Ziyaret ve Follow-up Yönetimi
- Ziyaret listesi ve filtreleme
- Follow-up sayfası

## Nasıl Kullanılır?

### Telefona Yükleme (PWA)
1. Uygulamayı Chrome/Safari'de açın
2. Menüden "Ana Ekrana Ekle" seçin
3. Artık uygulama gibi kullanabilirsiniz!

### Veri Yedekleme
1. Müşteriler sayfasında "Cloud" butonuna tıklayın
2. "Yedek Dosyasını İndir" ile .xlsx indirin
3. Google Drive veya OneDrive'a yükleyin

## Mimari

### Backend (FastAPI + MongoDB)
- `/api/auth/*` - Google Auth endpoints
- `/api/customers` - Müşteri CRUD
- `/api/visits` - Ziyaret CRUD
- `/api/options` - Dinamik seçenekler (renkli)
- `/api/export/*` - XLSX export endpoints

### Frontend (React + Shadcn/UI + PWA)
- Login sayfası (Google Auth)
- Dashboard, Müşteriler, Ziyaretler, Follow-up sayfaları
- CloudBackupModal, ImportModal komponentleri
- Service Worker for offline support

## Sonraki Geliştirmeler

1. **Otomatik Google Drive Sync**: OAuth ile direkt Drive'a kaydetme
2. **Push Notifications**: Follow-up hatırlatmaları
3. **Offline Data Sync**: İnternet olmadan çalışma
4. **Raporlama Dashboard**: Grafik ve PDF export
