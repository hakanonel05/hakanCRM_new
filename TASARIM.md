# Tasarım yenilemesi — devir notu

Bu dal (`tasarim-yenileme`) arayüzü baştan
[ingilizcemerkez.netlify.app](https://ingilizcemerkez.netlify.app) paletine ve
tipografisine taşıyor. Backend'e, veri modeline, iş mantığına dokunulmadı.

## Localde çalıştırma

İki terminal gerekiyor. Gerçek backend'e (Python + veritabanı) gerek yok:
ekranları veriyle doldurmaya yetecek bir sahte API var.

```bash
cd frontend && npm run sahte-api
```

```bash
cd frontend && npm start
```

Uygulama `http://localhost:3100` adresinde açılır (port `frontend/.env.local`
içinde). Giriş ekranını geçmek için tarayıcı konsolunda:

```js
localStorage.setItem('crmaster_user', JSON.stringify({
  id: 'u1', email: 'hakan@crmaster.net', name: 'Hakan Önel', role: 'admin'
}));
location.reload();
```

`scripts/sahte-api.mjs` yalnızca frontend'in çizilmesi için var — iş mantığı,
doğrulama, kalıcılık yok. Bilinmeyen uç noktalar boş dizi/nesne döner.

## Renk sistemi

Bütün renkler `frontend/src/index.css` içindeki `:root` bloğunda, shadcn'in
HSL üçlüsü biçiminde. **JSX'e hex yazılmaz**; her renk `tailwind.config.js`
üzerinden bir token adına bağlı.

| token | iş |
|---|---|
| `--primary` | dolu birincil eylem ve aktif menü öğesi (mürekkep) |
| `--brand` | marka, bölüm başlığı, satır içi bağlantı (turuncu) — **düğme zemini değil** |
| `--status-success-*` / `--status-danger-*` | gerçekten iyi/kötü olan durumlar |
| `--status-warning-*` | bekleyen; kehribar bir **işaret**tir, dolgu değil |
| `--status-info-*` | ayrı bir renk değil, nötr gri yüzey |
| `--chart-1..5` | grafik serileri: mürekkepten kağıda inen merdiven + marka |
| `--icon-*` | kenar çubuğu ikon grupları |

Üç kural:

1. **Renk bir şey ifade ettiğinde ortaya çıkar.** Kategori (market, şehir,
   ürün) bir durum değil — sessiz gri hap. Kategori haplarının rengi eskiden
   metnin hash'inden seçiliyordu: "Otomotiv" yeşile, "Kimya" kırmızıya
   düşüyordu. Bu bilgi değil gürültüydü, üstelik yeşil/kırmızının gerçek
   anlamını bozuyordu.
2. **Kenarlık gölgeden iyidir.** Kart ile zemin arasındaki fark 1px saç
   çizgisi ve iki tonun farkıyla kuruluyor. Gölge, buzlu cam, gradient yok.
3. **Hiyerarşi renkle değil boyut ve ağırlıkla.** Tek yazı ailesi (Inter);
   sayılarda JetBrains Mono, çünkü tutar ve tarih metin değil veridir.

## Ölçme

Bu dalda hiçbir renk göz kararıyla seçilmedi. Kontrast, gerçek zeminler
üzerinde canvas ile ölçüldü (`getComputedStyle` `oklch()` döndürebiliyor,
elle ayrıştırmak yanlış sonuç veriyor).

**Ölçüm iki kez yanılttı, ikisi de gölge sayarken:**

- Sınıf adına bakmak `shadow-none`'ı da sayıyordu.
- Hesaplanmış `box-shadow`'a bakmak Tailwind'in `ring` sıfırlamasını
  sayıyordu — o gölge tamamen saydam (`rgba(0,0,0,0)`), ekranda yok.

Doğru sayım saydam olanları eler ve `backdrop-filter`'ı ayrı sayar. Bir sayı
inanılmaz görünüyorsa **kodda değil ölçümde** hata ara.

## Kenar çubuğu ikonları

Ölçüt: 16 pikselde hiçbir iki satır aynı silueti paylaşmasın. Önce üç ayrı
insan ikonu (`Users`, `UsersRound`, `User`) ve iki takvim vardı; ayırt
edilmiyorlardı.

İş bölündü: **glif hangi satır olduğunu, renk ne tür bir şey olduğunu**
söylüyor. On üç ayrı ton denendi ve olmadı — izinli ton aralığı (mor/indigo
yasak; marka turuncusu ve işaret kehribarının çevresi de boş kalmalı) bunu
kaldırmıyor, `Filtreler` ile `Ayarlar` 10 RGB uzaklıkta çıkmıştı.

Beş grup: analiz, kayıtlar, akış/zaman, kişiler, sistem. Doygunluk %32 ve
hepsi kağıtta 3.56–3.63 kontrast bandında. Sabit HSL açıklığı eşit bir aile
vermiyor: göz yeşili maviden çok daha parlak görüyor, aynı %42'de biri 5.2
öteki 2.8 ölçüyor. Her tonun açıklığı ayrı çözüldü.

## Hız

Gerçek hacimde ölçüldü — 3150 müşteri, 1200 ziyaret. 48 kayıtla yapılan
ölçüm hiçbir şey söylemiyor; hacim sunucusu bunun için var:

```
npm run sahte-api-hacim          # 5000 kayıt (varsayılan)
MUSTERI_SAYISI=3150 npm run sahte-api-hacim
```

**Paket.** İlk açılışta inen JS 774 → 553 KB. Sebep `craco.config.js`
içindeki `vendors` grubuydu: `chunks: 'all'` iken yalnızca tembel
sayfalarda kullanılan satıcı kodu (react-grid-layout, react-day-picker +
date-fns, preact, react-redux) ortak parçaya toplanıp ilk açılışta
iniyordu. `'initial'` bunu kesiyor.

**Ziyaretler.** 6756 ms → 1426 ms, 26.979 → 3.632 DOM düğümü, 324 → 100 MB.
Üç sebep: süzgeç 3150 `<SelectItem>` çiziyordu, tablo bütün kayıtları tek
seferde çiziyordu, `getCustomerName` her çağrıda dizide `.find()`
yapıyordu. Ayrıntısı `f41932c` numaralı işlemenin mesajında.

> **Yayına alırken:** bu iş arka uca `GET /customers/lookup` ekliyor
> (`backend/server.py`). Ön yüz dağıtılıp arka uç dağıtılmazsa Ziyaretler
> ekranı bütün firma adlarını "Bilinmiyor" gösterir. İkisi birlikte gitmeli.

**Kanban ve Müşteriler'e dokunulmadı, çünkü gerek yoktu.** Kanban sütun
başına kart sayfalıyor (`Kanban.jsx:474`), Müşteriler sunucu tarafında
sayfalıyor. Ölçümde Kanban'ın 5 MB indirdiği görünüyordu; o **benim taklit
sunucumun** hatasıydı — gerçek arka uç yalnızca kart alanlarını seçiyor
(`server.py:4248`) ve 30 sn önbellekliyor. Taklit gerçeğine uyduruldu.
Yine aynı ders: sayı inanılmaz görünüyorsa önce ölçüm aletinden şüphelen.

## Bilinen açık konular

- Dashboard'daki "Son Aktiviteler" ve iki dağılım grafiği boş görünüyor —
  sahte API'nin veri şekli eksik, uygulama hatası değil.
- Konsolda `unique "key" prop` uyarısı var; tasarım çalışmasından önce de
  vardı.
- `components/CloudBackupModal.jsx` ve `pages/Login.jsx` içindeki hex'ler
  Google'ın logo renkleri — bilerek dokunulmadı.
- Kabuk kompozisyonu (kenar çubuğu ve üst çubuğun **yapısı**) korundu;
  değişen palet, tipografi ve ikonlar.
