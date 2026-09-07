/* CRMASTER ICIN SAHTE API
 * ============================================================================
 * Tasarimi degistirebilmek icin uygulamayi GORMEK gerekiyor; gormek icin de
 * ekranlarin veriyle dolmasi. Gercek backend Python + veritabani istiyor.
 * Bu sunucu yalnizca frontend'in cizilmesi icin yeterli veriyi uretiyor —
 * hicbir is mantigi yok, dogrulama yok, kalicilik yok.
 *
 * Bilinmeyen her uc nokta bos dizi/nesne donuyor: bir ekran veri bulamazsa
 * bos durumunu gosterir, cokmez.
 *
 * Sekiller backend/server.py'deki Pydantic modellerinden alindi.
 */
import http from 'node:http';

const PORT = 8787;

/* İl başına ağırlık. Sayılar Türkiye'nin sanayi yoğunluğunu kabaca izliyor:
   haritanın ısı rampası ancak dağılım dengesizken bir şey anlatır. */
const SEHIR_AGIRLIK = [
  ['İstanbul', 34], ['Ankara', 18], ['İzmir', 16], ['Bursa', 14], ['Kocaeli', 12],
  ['Antalya', 10], ['Konya', 9], ['Gaziantep', 9], ['Adana', 8], ['Kayseri', 8],
  ['Denizli', 7], ['Manisa', 7], ['Tekirdağ', 6], ['Sakarya', 6], ['Mersin', 6],
  ['Eskişehir', 5], ['Balıkesir', 5], ['Hatay', 5], ['Samsun', 4], ['Trabzon', 4],
  ['Aydın', 4], ['Muğla', 4], ['Şanlıurfa', 3], ['Diyarbakır', 3], ['Malatya', 3],
  ['Erzurum', 2], ['Sivas', 2], ['Van', 2], ['Elazığ', 2], ['Çorum', 2],
  ['Zonguldak', 2], ['Afyon', 2], ['Isparta', 1], ['Ordu', 1],
];
/* Ağırlıkları düz bir listeye açıyoruz (226 giriş); müşteri ataması
   i % uzunluk ile dönüyor, rastgelelik yok — her çalıştırmada aynı veri
   çıksın ki iki ölçüm karşılaştırılabilsin. */
const ac = (agirlikli) => agirlikli.flatMap(([ad, n]) => Array(n).fill(ad));
const SEHIR = ac(SEHIR_AGIRLIK);

/* Küçük deterministik karıştırıcı. i % n ile seçim yapılırsa 240 kayıt
   listelerin katı olduğu için bütün dağılımlar birebir eşit çıkıyor. Bu
   hizalanmayı kırıyor ama rastgele değil: aynı i hep aynı sonucu verir. */
const kar = (i, tuz) => {
  let h = Math.imul(i + 1, 2654435761) ^ Math.imul(tuz + 1, 40503);
  h ^= h >>> 13;
  h = Math.imul(h, 1274126177);
  return Math.abs(h ^ (h >>> 16));
};
const sec = (liste, i, tuz) => liste[kar(i, tuz) % liste.length];
const ILCE = ['Merkez', 'Nilüfer', 'Çankaya', 'Kadıköy', 'Bornova', 'Gebze', 'Selçuklu', 'Şehitkamil'];
/* Bir satış hunisi yukarıdan aşağı daralır; eşit dağılım gerçekçi değil. */
const DURUM = ac([['Beklemede', 30], ['Görüşülüyor', 24], ['Teklif Verildi', 17],
  ['Kazanıldı', 12], ['Kaybedildi', 9]]);
const SEVIYE = ac([['Düşük', 20], ['Orta', 15], ['Yüksek', 8]]);
const PAZAR = ac([['Otomotiv', 22], ['İnşaat', 18], ['Gıda', 14], ['Tekstil', 12],
  ['Enerji', 10], ['Kimya', 9], ['Lojistik', 8], ['Sağlık', 6]]);
const UYGULAMA = ac([['Üretim Takibi', 18], ['Depo Yönetimi', 15], ['Bakım Planlama', 11],
  ['Kalite Kontrol', 8], ['Filo', 5]]);
const KISI = ['Ayşe Yıldız', 'Mehmet Kaya', 'Elif Demir', 'Burak Şahin', 'Zeynep Arslan', 'Can Öztürk'];
const URUN = ['Sensör', 'PLC', 'Sürücü', 'Panel', 'Yazılım Lisansı'];
const RAKIP = ac([['Siemens', 14], ['Schneider', 11], ['Rockwell', 7], ['Omron', 5], ['', 12]]);
const ORTAK = ac([['Beckhoff', 10], ['Festo', 8], ['Balluff', 6], ['Pilz', 4], ['', 20]]);

const sirketAdi = (i) => {
  const on = ['Anadolu', 'Ege', 'Marmara', 'Toros', 'Kuzey', 'Öz', 'Yıldız', 'Deniz', 'Akdeniz', 'Başak'];
  const orta = ['Makine', 'Endüstri', 'Teknoloji', 'Metal', 'Otomasyon', 'Enerji', 'Plastik', 'Tekstil'];
  const son = ['A.Ş.', 'Ltd. Şti.', 'San. Tic.'];
  return on[i % on.length] + ' ' + orta[(i * 3) % orta.length] + ' ' + son[i % son.length];
};

const gun = (kaydirma) => {
  const t = new Date();
  t.setDate(t.getDate() + kaydirma);
  return t.toISOString().slice(0, 10);
};

/* 48 kayıt dashboard'u denemeye yetmiyordu: 10 il, tek renk harita, boş
   dağılım grafikleri. 240 kayıt hem haritayı hem donut'ları doldurur, hem
   de ekranları yavaşlatmayacak kadar küçüktür. Hacim denemesi için ayrı
   sunucu var (sahte-api-hacim.mjs). */
const MUSTERILER = Array.from({ length: 240 }, (_, i) => ({
  id: 'm' + (i + 1),
  company_name: sirketAdi(i),
  market: sec(PAZAR, i, 1),
  application: sec(UYGULAMA, i, 2),
  city: sec(SEHIR, i, 3),
  district: ILCE[i % ILCE.length],
  website: 'www.' + ['anadolu', 'ege', 'marmara', 'toros', 'kuzey'][i % 5] + i + '.com.tr',
  status: sec(DURUM, i, 4),
  contact_info: { phone: '0212 555 ' + String(1000 + i).slice(0, 4), email: 'info@firma' + i + '.com.tr' },
  contacts: [{ name: KISI[i % KISI.length], title: 'Satın Alma Müdürü', phone: '0532 555 ' + String(2000 + i).slice(0, 4) }],
  potential_value: [45000, 120000, 380000, 75000, 260000, 890000][i % 6],
  next_followup_date: i % 3 === 0 ? gun((i % 9) - 3) : '',
  assigned_to: sec(KISI, i, 5),
  competitor: sec(RAKIP, i, 6),
  partner: sec(ORTAK, i, 7),
  potential_level: sec(SEVIYE, i, 8),
  products: [URUN[i % URUN.length], URUN[(i + 2) % URUN.length]],
  description: 'Mevcut hattın modernizasyonu için görüşme sürüyor.',
  notes: '',
  notes_list: [],
  documents: [],
  tags: i % 4 === 0 ? ['öncelikli'] : [],
  is_followup: i % 3 === 0,
  created_at: new Date(Date.now() - i * 86400000 * 3).toISOString(),
  updated_at: new Date(Date.now() - i * 86400000).toISOString(),
  ai_filled: {},
}));

const ZIYARETLER = Array.from({ length: 18 }, (_, i) => ({
  id: 'z' + (i + 1),
  customer_id: 'm' + ((i % 20) + 1),
  company_name: sirketAdi(i % 20),
  visit_date: gun(-(i * 2)),
  visit_type: ['Yerinde', 'Online', 'Telefon'][i % 3],
  notes: 'Numune teslim edildi, teknik ekiple değerlendirilecek.',
  created_by: KISI[i % KISI.length],
  next_followup_date: i % 2 ? gun(i + 2) : '',
  created_at: new Date(Date.now() - i * 86400000 * 2).toISOString(),
}));

const ARAMALAR = Array.from({ length: 14 }, (_, i) => ({
  id: 'a' + (i + 1),
  customer_id: 'm' + ((i % 20) + 1),
  company_name: sirketAdi(i % 20),
  call_date: gun(-i),
  duration: 5 + (i % 25),
  notes: 'Fiyat listesi talep edildi.',
  created_by: KISI[(i + 1) % KISI.length],
}));

/* Haritanın üstündeki 5 açılır liste bu filtreleri gönderiyor; hepsi tam
   eşleşme, /customers listesindeki davranışın aynısı. */
const suz = (q) => {
  let r = MUSTERILER;
  if (q.get('followup_only') === 'true') r = r.filter((x) => x.is_followup);
  for (const alan of ['market', 'application', 'status', 'competitor', 'partner', 'assigned_to']) {
    const d = q.get(alan);
    if (d) r = r.filter((x) => (x[alan] || '') === d);
  }
  return r;
};

/* Ekran seçenekleri {id, field_name, value, color} NESNESİ olarak okuyor
   (CustomerEditModal.jsx:101, gerçek arka uçta DynamicOption). Düz metin
   dizisi dönerken o.value undefined kalıyor ve müşteri düzenleme pop-up'ı
   "Cannot read properties of undefined (reading 'toLowerCase')" ile
   çöküyordu.

   Listeler ayrıca benzersizleştiriliyor: PAZAR/DURUM/SEHIR, dağılımı
   dengesizleştirmek için açılmış ağırlıklı diziler ("Otomotiv" 22 kez);
   seçenek listesinde her değer bir kez görünmeli. */
const secenekler = (alan, liste) =>
  [...new Set(liste)].filter(Boolean).map((v, i) => ({
    id: alan + '-' + i,
    field_name: alan,
    value: v,
    /* Renk alanı arka uçta var ama arayüz artık göz ardı ediyor
       (bkz. CreatableSelect.jsx). Şekil bozulmasın diye duruyor. */
    color: null,
  }));

const SECENEKLER = {
  market: secenekler('market', PAZAR),
  application: secenekler('application', UYGULAMA),
  status: secenekler('status', DURUM),
  potential_level: secenekler('potential_level', SEVIYE),
  products: secenekler('products', URUN),
  city: secenekler('city', SEHIR),
  competitor: secenekler('competitor', RAKIP),
  partner: secenekler('partner', ORTAK),
};

/* SÜREÇ PANOLARI DEPOSU
   Bu ekran yazma yapıyor: pano/stage/kart ekleniyor, siliniyor, sürükleniyor.
   Sabit yanıt yetmediği için bellekte durum tutuluyor. Sunucu yeniden
   başlayınca sıfırlanır. */
let _no = 0;
/* 'y' eki: hazir kayitlar 'stage-0..4' seklinde numaralaniyor; sayac
   ayni bicimi uretirse yeni stage hazir bir stage'in kimligini kapiyor ve
   baskasinin kartlarini gosteriyor. Bir kez basima geldi. */
const kimlik = (on) => on + '-y' + (++_no);

/* Kart üstünde gösterilen müşteri alanları — arka uçtaki
   _PROCESS_CARD_CUSTOMER_FIELDS ile aynı. */
const kartMusterisi = (m) => m && {
  id: m.id, company_name: m.company_name, market: m.market, application: m.application,
  city: m.city, status: m.status, potential_level: m.potential_level,
  assigned_to: m.assigned_to, contact_info: m.contact_info, is_followup: m.is_followup,
  partner: m.partner,
};

const SUREC = {
  panolar: [{ id: 'pano-0', name: 'Teklif Süreci', position: 0, created_at: new Date().toISOString() }],
  stageler: [],
  kartlar: [],
};

/* Açılışta bir pano dolu gelsin ki ekran boş görünmesin. */
DURUM.filter((d, i, a) => a.indexOf(d) === i).forEach((ad, i) => {
  SUREC.stageler.push({ id: 'stage-' + i, board_id: 'pano-0', name: ad, color: '', position: i, created_at: new Date().toISOString() });
});
MUSTERILER.slice(0, 12).forEach((m, i) => {
  const st = SUREC.stageler[i % SUREC.stageler.length];
  SUREC.kartlar.push({
    id: 'kart-' + i, board_id: 'pano-0', stage_id: st.id, customer_id: m.id,
    note: '', position: SUREC.kartlar.filter((k) => k.stage_id === st.id).length,
    created_at: new Date().toISOString(),
  });
});

const surecTamPano = (panoId) => {
  const pano = SUREC.panolar.find((p) => p.id === panoId);
  if (!pano) return { board: null, stages: [] };
  const stageler = SUREC.stageler.filter((x) => x.board_id === panoId).sort((a, b) => a.position - b.position);
  return {
    board: { id: pano.id, name: pano.name, position: pano.position },
    stages: stageler.map((st) => ({
      id: st.id, name: st.name, color: st.color, position: st.position,
      cards: SUREC.kartlar
        .filter((k) => k.stage_id === st.id)
        .sort((a, b) => a.position - b.position)
        .map((k) => ({
          id: k.id, note: k.note, position: k.position,
          customer: kartMusterisi(MUSTERILER.find((m) => m.id === k.customer_id)),
        }))
        /* Müşterisi bulunamayan kartı atla — arka uç da öyle yapıyor. */
        .filter((k) => k.customer),
    })),
  };
};

const say = (alan) => {
  const m = {};
  for (const x of MUSTERILER) { const k = x[alan] || '—'; m[k] = (m[k] || 0) + 1; }
  return Object.entries(m).map(([name, value]) => ({ name, value, count: value }));
};

/* Bilinen uc noktalar. Sirasi onemli: en uzun yol once denenmeli. */
const YOLLAR = [
  ['GET', /^\/api\/auth\/me$/, () => ({ id: 'u1', email: 'hakan@crmaster.net', name: 'Hakan Önel', role: 'admin', picture: '' })],
  /* Gerçek arka uçtaki /customers/lookup ile aynı: yalnızca id + ad.
     /customers/{id} rotasından ÖNCE gelmeli. */
  ['GET', /^\/api\/customers\/lookup$/, () => ({
    data: MUSTERILER.map((m) => ({ id: m.id, company_name: m.company_name })),
    total: MUSTERILER.length,
  })],
  ['GET', /^\/api\/customers\/filter-options$/, () => ({
    cities: [...new Set(MUSTERILER.map((m) => m.city))],
    markets: [...new Set(MUSTERILER.map((m) => m.market))],
    statuses: DURUM, potential_levels: SEVIYE,
    assigned_to: [...new Set(MUSTERILER.map((m) => m.assigned_to))],
  })],
  ['GET', /^\/api\/customers\/([^/]+)\/similar$/, () => []],
  ['GET', /^\/api\/customers\/([^/]+)$/, (m) => MUSTERILER.find((x) => x.id === m[1]) || MUSTERILER[0]],
  /* SUNUCU TARAFI SAYFALAMA — gerçek uçtaki sözleşmenin aynısı
     ({data, total, page, limit, total_pages}, bkz. backend/server.py).
     Süzme ve sıralama da burada, çünkü uygulama onları sunucudan bekliyor. */
  ['GET', /^\/api\/customers$/, (m, q) => {
    const kucult = (x) => String(x || '').toLocaleLowerCase('tr');
    const ara = kucult(q.get('search'));
    const alanEsle = (x, ad) => {
      const v = q.get(ad);
      return !v || v === 'all' || x[ad] === v;
    };
    let liste = MUSTERILER.filter((x) =>
      alanEsle(x, 'market') && alanEsle(x, 'status') && alanEsle(x, 'city') &&
      alanEsle(x, 'application') && alanEsle(x, 'competitor') && alanEsle(x, 'partner') &&
      alanEsle(x, 'assigned_to') &&
      (!ara || kucult(x.company_name).includes(ara) || kucult(x.city).includes(ara) ||
        kucult(x.market).includes(ara)));

    const alan = q.get('sort_by') || 'created_at';
    const yon = q.get('sort_order') === 'asc' ? 1 : -1;
    liste = [...liste].sort((x, y) => {
      const p = x[alan], r = y[alan];
      if (typeof p === 'number' && typeof r === 'number') return (p - r) * yon;
      return String(p ?? '').localeCompare(String(r ?? ''), 'tr') * yon;
    });

    const limit = Math.max(1, Number(q.get('limit') || 50));
    const sayfa = Math.max(1, Number(q.get('page') || 1));
    return {
      data: liste.slice((sayfa - 1) * limit, sayfa * limit),
      total: liste.length,
      page: sayfa,
      limit,
      total_pages: Math.max(1, Math.ceil(liste.length / limit)),
    };
  }],
  ['GET', /^\/api\/visits$/, () => ZIYARETLER],
  ['GET', /^\/api\/calls$/, () => ARAMALAR],
  /* Ekran {customers: [...], visits: [...]} bekliyor; duz dizi donerken
     "Cannot read properties of undefined (reading 'length')" veriyordu. */
  ['GET', /^\/api\/followups$/, () => ({
    customers: MUSTERILER.filter((m) => m.is_followup).slice(0, 9),
    visits: ZIYARETLER.filter((z) => z.next_followup_date).slice(0, 6),
  })],
  /* Gerçek arka uç activity_log tablosunu bu şekle çeviriyor
     (server.py:2917). Ekran title/subtitle/timestamp bekliyor; eski taklit
     message/created_at döndürdüğü için "Son Aktiviteler" boş görünüyordu. */
  ['GET', /^\/api\/activity-feed$/, (m, q) => {
    const adet = Math.min(Number(q.get('limit') || 20), 50);
    const TIP = [
      ['customer_created', 'Yeni müşteri', (c) => 'Durum: ' + c.status],
      ['status_changed', 'Durum değişti', (c) => 'Yeni durum: ' + c.status],
      ['visit_created', 'Ziyaret eklendi', (c) => c.city + ' · ' + c.assigned_to],
      ['call_created', 'Arama kaydedildi', (c) => c.contacts[0].name],
      ['followup_changed', 'Takibe alındı', (c) => 'Sorumlu: ' + c.assigned_to],
      ['contact_added', 'Kişi eklendi', (c) => c.contacts[0].title],
      ['file_uploaded', 'Dosya yüklendi', () => 'teklif.pdf'],
      ['customer_updated', 'Müşteri güncellendi', (c) => c.market],
    ];
    return Array.from({ length: adet }, (_, i) => {
      const c = MUSTERILER[i % MUSTERILER.length];
      const [tip, baslik, altYazi] = TIP[i % TIP.length];
      return {
        id: 'af' + i,
        type: tip,
        title: baslik + ': ' + c.company_name,
        subtitle: altYazi(c),
        timestamp: new Date(Date.now() - i * 5400000).toISOString(),
        customer_id: c.id,
        customer_name: c.company_name,
      };
    });
  }],
  /* Aşağıdaki üç uç noktanın yanıt şekli backend/server.py'dan birebir
     alındı. Önceki taklit uydurma bir şekil döndürüyordu (by_status,
     by_city...) ve ekran onu okuyamadığı için harita "0 müşteri"
     gösteriyordu. */

  ['GET', /^\/api\/stats\/distribution$/, (m, q) => {
    const alan = q.get('field') || 'market';
    const sinir = Math.min(Number(q.get('limit') || 10), 50);
    const d = {};
    for (const x of suz(q)) { const v = (x[alan] || '').trim(); if (v) d[v] = (d[v] || 0) + 1; }
    const entries = Object.entries(d).map(([_id, count]) => ({ _id, count }))
      .sort((a, b) => b.count - a.count).slice(0, sinir);
    return {
      field: alan,
      followup_only: q.get('followup_only') === 'true',
      total: entries.reduce((a, e) => a + e.count, 0),
      entries,
    };
  }],

  /* Bir ile tıklanınca açılan panel: o ildeki pazar dağılımı. */
  ['GET', /^\/api\/stats\/city-markets$/, (m, q) => {
    const il = q.get('city') || '';
    const r = suz(q).filter((x) => x.city === il);
    const d = {};
    for (const x of r) { const v = (x.market || '').trim() || 'Belirtilmemiş'; d[v] = (d[v] || 0) + 1; }
    return {
      city: il,
      total: r.length,
      entries: Object.entries(d).map(([market, count]) => ({ market, count }))
        .sort((a, b) => b.count - a.count),
    };
  }],

  /* Donut diliminin arkasındaki müşteri listesi. */
  ['GET', /^\/api\/stats\/segment$/, (m, q) => {
    const alan = q.get('field') || 'market';
    const deger = q.get('value') || '';
    let r = MUSTERILER.filter((x) => (x[alan] || '') === deger);
    if (q.get('followup_only') === 'true') r = r.filter((x) => x.is_followup);
    r = r.sort((a, b) => a.company_name.localeCompare(b.company_name, 'tr'))
         .slice(0, Math.min(Number(q.get('limit') || 100), 500));
    return {
      field: alan,
      value: deger,
      followup_only: q.get('followup_only') === 'true',
      count: r.length,
      customers: r.map((x) => ({
        id: x.id, company_name: x.company_name, status: x.status, market: x.market,
        city: x.city, partner: x.partner, assigned_to: x.assigned_to, is_followup: x.is_followup,
      })),
    };
  }],
  ['GET', /^\/api\/stats/, () => ({
    total_customers: MUSTERILER.length,
    total_visits: ZIYARETLER.length,
    total_calls: ARAMALAR.length,
    total_potential: MUSTERILER.reduce((a, b) => a + b.potential_value, 0),
    won: MUSTERILER.filter((m) => m.status === 'Kazanıldı').length,
    pending: MUSTERILER.filter((m) => m.status === 'Beklemede').length,
  })],
  /* Şekli SECENEKLER'de, dizinin dışında kuruluyor. */
  ['GET', /^\/api\/options\/grouped$/, () => SECENEKLER],
  ['GET', /^\/api\/options\/([^/]+)$/, (m) => SECENEKLER[m[1]] || []],
  ['GET', /^\/api\/options$/, () => Object.values(SECENEKLER).flat()],
  ['GET', /^\/api\/kanban\/views$/, () => [{ id: 'k1', name: 'Satış Süreci', group_by: 'status', is_default: true }]],
  /* Kanban bunu bir DIZI bekliyor ve .find() cagiriyor; bilinmeyen yol {}
     donduren yedege dusuyordu, ekran da o yuzden cokuyordu. */
  ['GET', /^\/api\/kanban\/group-fields$/, () => [
    { value: 'status', label: 'Durum' },
    { value: 'potential_level', label: 'Potansiyel' },
    { value: 'city', label: 'Şehir' },
    { value: 'assigned_to', label: 'Sorumlu' },
    { value: 'market', label: 'Market' },
  ]],
  /* Kanban bunu SUTUNLARA GRUPLANMIS bir nesne bekliyor: {sutunAdi: [...]}.
     Duz dizi donerken "customers.slice is not a function" veriyordu. */
  ['GET', /^\/api\/kanban\/customers$/, (m, sorgu) => {
    const alan = (sorgu.get('group_by') || 'status');
    const gecerli = ['status', 'potential_level', 'city', 'assigned_to', 'market'].includes(alan) ? alan : 'status';
    const sutun = {};
    for (const x of MUSTERILER) {
      const k = x[gecerli] || '—';
      (sutun[k] ||= []).push(x);
    }
    return sutun;
  }],
  /* SÜREÇ PANOLARI. Sıra önemli: /full ve /stages, /{id} kalıbından
     ÖNCE gelmeli, yoksa "full" bir pano kimliği sanılır. */
  ['GET', /^\/api\/process\/boards$/, () => [...SUREC.panolar].sort((a, b) => a.position - b.position)],
  ['POST', /^\/api\/process\/boards$/, (m, q, govde) => {
    const ad = String(govde?.name || '').trim();
    if (!ad) return { detail: 'Pano adı gerekli' };
    const pano = {
      id: kimlik('pano'), name: ad,
      position: SUREC.panolar.length ? Math.max(...SUREC.panolar.map((p) => p.position)) + 1 : 0,
      created_at: new Date().toISOString(),
    };
    SUREC.panolar.push(pano);
    return pano;
  }],
  ['GET', /^\/api\/process\/boards\/([^/]+)\/full$/, (m) => surecTamPano(m[1])],
  ['PATCH', /^\/api\/process\/boards\/([^/]+)\/stages\/reorder$/, (m, q, govde) => {
    (govde?.stage_ids || []).forEach((sid, i) => {
      const st = SUREC.stageler.find((x) => x.id === sid && x.board_id === m[1]);
      if (st) st.position = i;
    });
    return { message: 'Stage sırası güncellendi' };
  }],
  ['POST', /^\/api\/process\/boards\/([^/]+)\/stages$/, (m, q, govde) => {
    const ad = String(govde?.name || '').trim();
    if (!ad) return { detail: 'Stage adı gerekli' };
    const kardesler = SUREC.stageler.filter((x) => x.board_id === m[1]);
    const st = {
      id: kimlik('stage'), board_id: m[1], name: ad, color: govde?.color || '',
      position: kardesler.length ? Math.max(...kardesler.map((x) => x.position)) + 1 : 0,
      created_at: new Date().toISOString(),
    };
    SUREC.stageler.push(st);
    return { ...st, cards: [] };
  }],
  ['PUT', /^\/api\/process\/boards\/([^/]+)$/, (m, q, govde) => {
    const pano = SUREC.panolar.find((p) => p.id === m[1]);
    if (pano) pano.name = String(govde?.name || '').trim() || pano.name;
    return { id: m[1], name: pano?.name };
  }],
  ['DELETE', /^\/api\/process\/boards\/([^/]+)$/, (m) => {
    SUREC.kartlar = SUREC.kartlar.filter((k) => k.board_id !== m[1]);
    SUREC.stageler = SUREC.stageler.filter((x) => x.board_id !== m[1]);
    SUREC.panolar = SUREC.panolar.filter((p) => p.id !== m[1]);
    return { message: 'Pano silindi' };
  }],

  ['PUT', /^\/api\/process\/stages\/([^/]+)$/, (m, q, govde) => {
    const st = SUREC.stageler.find((x) => x.id === m[1]);
    if (st) {
      st.name = String(govde?.name || '').trim() || st.name;
      if (govde?.color != null) st.color = govde.color;
    }
    return { id: m[1], name: st?.name, color: st?.color };
  }],
  ['DELETE', /^\/api\/process\/stages\/([^/]+)$/, (m) => {
    SUREC.kartlar = SUREC.kartlar.filter((k) => k.stage_id !== m[1]);
    SUREC.stageler = SUREC.stageler.filter((x) => x.id !== m[1]);
    return { message: 'Stage silindi' };
  }],
  ['POST', /^\/api\/process\/stages\/([^/]+)\/cards$/, (m, q, govde) => {
    const st = SUREC.stageler.find((x) => x.id === m[1]);
    if (!st) return { detail: 'Stage bulunamadı' };
    /* Aynı müşteri aynı panoda iki kez olamaz — arka uçtaki kural. */
    if (SUREC.kartlar.some((k) => k.board_id === st.board_id && k.customer_id === govde?.customer_id)) {
      return { detail: 'Bu müşteri zaten bu panoda mevcut' };
    }
    const kart = {
      id: kimlik('kart'), board_id: st.board_id, stage_id: st.id,
      customer_id: govde?.customer_id, note: govde?.note || '',
      position: SUREC.kartlar.filter((k) => k.stage_id === st.id).length,
      created_at: new Date().toISOString(),
    };
    SUREC.kartlar.push(kart);
    return {
      id: kart.id, note: kart.note, position: kart.position, stage_id: st.id,
      customer: kartMusterisi(MUSTERILER.find((x) => x.id === kart.customer_id)) || null,
    };
  }],
  ['DELETE', /^\/api\/process\/cards\/([^/]+)$/, (m) => {
    SUREC.kartlar = SUREC.kartlar.filter((k) => k.id !== m[1]);
    return { message: 'Kart kaldırıldı' };
  }],
  ['PATCH', /^\/api\/process\/cards\/([^/]+)\/move$/, (m, q, govde) => {
    const kart = SUREC.kartlar.find((k) => k.id === m[1]);
    const hedef = SUREC.stageler.find((x) => x.id === govde?.stage_id);
    if (!kart || !hedef) return { detail: 'Kart ya da stage bulunamadı' };
    kart.stage_id = hedef.id;
    kart.board_id = hedef.board_id;
    /* Hedef stage'i baştan numarala, taşınan kart istenen sıraya girsin. */
    const kardesler = SUREC.kartlar.filter((k) => k.stage_id === hedef.id && k.id !== kart.id)
      .sort((a, b) => a.position - b.position);
    const yer = Math.max(0, Math.min(Number(govde?.position ?? 0), kardesler.length));
    kardesler.splice(yer, 0, kart);
    kardesler.forEach((k, i) => { k.position = i; });
    return { message: 'Kart taşındı' };
  }],
  /* Gerçek model SavedFilter: {conditions: [{field, operator, value}], logic}.
     Taklit {criteria: {...}} döndürdüğü için Filtreler ekranı filtreyi
     uygulamaya çalışınca "filter.conditions is not iterable" veriyordu. */
  ['GET', /^\/api\/filters$/, () => [
    {
      id: 'f1', name: 'Yüksek potansiyel', logic: 'AND', created_by: 'Hakan Önel',
      conditions: [{ field: 'potential_level', operator: 'equals', value: 'Yüksek' }],
    },
    {
      id: 'f2', name: 'İstanbul · teklif aşamasında', logic: 'AND', created_by: 'Hakan Önel',
      conditions: [
        { field: 'city', operator: 'equals', value: 'İstanbul' },
        { field: 'status', operator: 'equals', value: 'Teklif Verildi' },
      ],
    },
    {
      id: 'f3', name: 'Rakibi Siemens olanlar', logic: 'AND', created_by: 'Hakan Önel',
      conditions: [{ field: 'competitor', operator: 'equals', value: 'Siemens' }],
    },
  ]],

  /* Müşteri düzenleme pop-up'ı yazdıkça bunu çağırıyor: aynı firmadan
     ikinci kayıt açılmasın diye. Yanıt SimilarityResult listesi. */
  ['POST', /^\/api\/customers\/check-similar$/, (m, q, govde) => {
    const ad = String(govde?.company_name || '').toLocaleLowerCase('tr').trim();
    if (ad.length < 3) return [];
    const haric = q.get('exclude_id');
    return MUSTERILER
      .filter((x) => x.id !== haric && x.company_name.toLocaleLowerCase('tr').includes(ad.slice(0, 6)))
      .slice(0, 3)
      .map((x) => ({
        customer_id: x.id,
        company_name: x.company_name,
        similarity_score: 0.82,
        match_type: 'company_name',
      }));
  }],
  ['POST', /^\/api\/customers\/check-similarity$/, () => ({
    items: [], total_new: 0, total_similar: 0, total_duplicate: 0,
  })],
  ['GET', /^\/api\/users\/me\/notifications$/, () => ZIYARETLER.slice(0, 5).map((z, i) => ({
    id: 'n' + i, title: z.company_name, message: 'Takip tarihi yaklaşıyor', is_read: i > 2, created_at: z.created_at,
  }))],
  ['GET', /^\/api\/team-members/, () => KISI.map((k, i) => ({ id: 't' + i, name: k, email: 'x' + i + '@crmaster.net', customer_count: 6 + i }))],
  ['GET', /^\/api\/users$/, () => KISI.slice(0, 4).map((k, i) => ({ id: 'u' + i, name: k, email: 'x' + i + '@crmaster.net', role: i ? 'user' : 'admin' }))],
  ['GET', /^\/api\/allowed-users$/, () => []],
  ['GET', /^\/api\/backups\/config$/, () => ({ enabled: false, schedule: 'daily' })],
];

const sunucu = http.createServer((req, res) => {
  const yol = decodeURIComponent((req.url || '').split('?')[0]);
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  /* JOKER DEĞİL. Allow-Credentials: true ile birlikte '*' geçersiz;
     tarayıcı kimlik bilgili isteklerde başlık adlarının tek tek
     yazılmasını istiyor ve content-type'ı reddediyor. Bu yüzden JSON
     gövdeli her POST ön kontrolde takılıyordu. İstenen başlıklar aynen
     geri yansıtılıyor. */
  res.setHeader('Access-Control-Allow-Headers',
    req.headers['access-control-request-headers'] || 'Content-Type, Authorization, X-Session-Token');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  /* İSTEK GÖVDESİNİ OKU. Okumadan yanıt verip bağlantıyı kapatınca Node
     gönderilmemiş gövde kalan bağlantıyı sıfırlıyor; tarayıcı bunu
     "Network Error" olarak görüyor ve POST çağrısı yapan her ekran
     (ör. müşteri düzenlemede benzerlik kontrolü) konsola hata basıyor. */
  const govdeOku = () => new Promise((coz) => {
    if (req.method === 'GET' || req.method === 'HEAD') return coz(null);
    let ham = '';
    req.on('data', (p) => { ham += p; });
    req.on('end', () => { try { coz(ham ? JSON.parse(ham) : null); } catch { coz(null); } });
    req.on('error', () => coz(null));
  });

  govdeOku().then((istekGovdesi) => {
  let govde = null;
  for (const [yontem, kalip, uret] of YOLLAR) {
    if (req.method !== yontem) continue;
    const m = kalip.exec(yol);
    if (m) { govde = uret(m, new URLSearchParams((req.url || '').split('?')[1] || ''), istekGovdesi); break; }
  }
  /* Bilinmeyen: bos. Ekran bos durumunu gosterir, cokmez. */
  if (govde === null) govde = /\/(customers|visits|calls|users|options|filters|boards|notifications|suggestions|duplicates)/.test(yol) ? [] : {};

  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(govde));
  });
});

sunucu.listen(PORT, () => console.log('sahte CRM API: http://localhost:' + PORT));
