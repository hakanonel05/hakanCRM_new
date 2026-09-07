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

const SEHIR = ['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Kocaeli', 'Konya', 'Gaziantep', 'Adana', 'Kayseri'];
const ILCE = ['Merkez', 'Nilüfer', 'Çankaya', 'Kadıköy', 'Bornova', 'Gebze', 'Selçuklu', 'Şehitkamil'];
const DURUM = ['Beklemede', 'Görüşülüyor', 'Teklif Verildi', 'Kazanıldı', 'Kaybedildi'];
const SEVIYE = ['Düşük', 'Orta', 'Yüksek'];
const PAZAR = ['Otomotiv', 'Gıda', 'Tekstil', 'İnşaat', 'Enerji', 'Lojistik', 'Sağlık', 'Kimya'];
const UYGULAMA = ['Depo Yönetimi', 'Üretim Takibi', 'Filo', 'Bakım Planlama', 'Kalite Kontrol'];
const KISI = ['Ayşe Yıldız', 'Mehmet Kaya', 'Elif Demir', 'Burak Şahin', 'Zeynep Arslan', 'Can Öztürk'];
const URUN = ['Sensör', 'PLC', 'Sürücü', 'Panel', 'Yazılım Lisansı'];
const RAKIP = ['Siemens', 'Schneider', 'Rockwell', 'Omron', ''];

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

const MUSTERILER = Array.from({ length: 48 }, (_, i) => ({
  id: 'm' + (i + 1),
  company_name: sirketAdi(i),
  market: PAZAR[i % PAZAR.length],
  application: UYGULAMA[i % UYGULAMA.length],
  city: SEHIR[i % SEHIR.length],
  district: ILCE[i % ILCE.length],
  website: 'www.' + ['anadolu', 'ege', 'marmara', 'toros', 'kuzey'][i % 5] + i + '.com.tr',
  status: DURUM[i % DURUM.length],
  contact_info: { phone: '0212 555 ' + String(1000 + i).slice(0, 4), email: 'info@firma' + i + '.com.tr' },
  contacts: [{ name: KISI[i % KISI.length], title: 'Satın Alma Müdürü', phone: '0532 555 ' + String(2000 + i).slice(0, 4) }],
  potential_value: [45000, 120000, 380000, 75000, 260000, 890000][i % 6],
  next_followup_date: i % 3 === 0 ? gun((i % 9) - 3) : '',
  assigned_to: KISI[(i + 2) % KISI.length],
  competitor: RAKIP[i % RAKIP.length],
  partner: '',
  potential_level: SEVIYE[i % SEVIYE.length],
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
  ['GET', /^\/api\/customers$/, () => MUSTERILER],
  ['GET', /^\/api\/visits$/, () => ZIYARETLER],
  ['GET', /^\/api\/calls$/, () => ARAMALAR],
  /* Ekran {customers: [...], visits: [...]} bekliyor; duz dizi donerken
     "Cannot read properties of undefined (reading 'length')" veriyordu. */
  ['GET', /^\/api\/followups$/, () => ({
    customers: MUSTERILER.filter((m) => m.is_followup).slice(0, 9),
    visits: ZIYARETLER.filter((z) => z.next_followup_date).slice(0, 6),
  })],
  ['GET', /^\/api\/activity-feed$/, () => ZIYARETLER.slice(0, 10).map((z, i) => ({
    id: 'af' + i,
    type: ['visit', 'call', 'note', 'status'][i % 4],
    customer_id: z.customer_id,
    company_name: z.company_name,
    user: z.created_by,
    message: ['ziyaret ekledi', 'arama kaydetti', 'not düştü', 'durumu güncelledi'][i % 4],
    created_at: z.created_at,
  }))],
  ['GET', /^\/api\/stats\/segment/, () => MUSTERILER.slice(0, 12)],
  ['GET', /^\/api\/stats\/distribution$/, () => ({
    by_status: say('status'), by_city: say('city').slice(0, 8),
    by_market: say('market'), by_potential: say('potential_level'),
  })],
  ['GET', /^\/api\/stats/, () => ({
    total_customers: MUSTERILER.length,
    total_visits: ZIYARETLER.length,
    total_calls: ARAMALAR.length,
    total_potential: MUSTERILER.reduce((a, b) => a + b.potential_value, 0),
    won: MUSTERILER.filter((m) => m.status === 'Kazanıldı').length,
    pending: MUSTERILER.filter((m) => m.status === 'Beklemede').length,
  })],
  ['GET', /^\/api\/options\/grouped$/, () => ({
    market: PAZAR, application: UYGULAMA, status: DURUM,
    potential_level: SEVIYE, products: URUN, city: SEHIR,
  })],
  ['GET', /^\/api\/options$/, () => PAZAR.map((v, i) => ({ id: 'o' + i, category: 'market', value: v }))],
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
  ['GET', /^\/api\/process\/boards$/, () => [{ id: 'p1', name: 'Teklif Süreci', columns: DURUM.map((d, i) => ({ id: 'c' + i, name: d })) }]],
  ['GET', /^\/api\/filters$/, () => [{ id: 'f1', name: 'Yüksek potansiyel', criteria: { potential_level: 'Yüksek' } }]],
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
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  let govde = null;
  for (const [yontem, kalip, uret] of YOLLAR) {
    if (req.method !== yontem) continue;
    const m = kalip.exec(yol);
    if (m) { govde = uret(m, new URLSearchParams((req.url || '').split('?')[1] || '')); break; }
  }
  /* Bilinmeyen: bos. Ekran bos durumunu gosterir, cokmez. */
  if (govde === null) govde = /\/(customers|visits|calls|users|options|filters|boards|notifications|suggestions|duplicates)/.test(yol) ? [] : {};

  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(govde));
});

sunucu.listen(PORT, () => console.log('sahte CRM API: http://localhost:' + PORT));
