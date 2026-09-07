/* HACİM TESTİ İÇİN SAHTE API
 * ============================================================================
 * sahte-api.mjs 48 müşteri üretiyor ve bu YANILTICI: tablo, kanban ve
 * grafikler binlerce kayıtta bambaşka davranıyor. Bu sürüm hacmi ve uç
 * değerleri veriyor.
 *
 *   MUSTERI_SAYISI çevre değişkeniyle ayarlanır (varsayılan 5000).
 *
 * UÇ DEĞERLER bilerek serpiştirildi, çünkü kırılmalar oralarda çıkıyor:
 *   - çok uzun firma adı (tablo hücresi taşar mı, kanban kartı büyür mü)
 *   - boş alanlar (şehir, rakip, sorumlu yok)
 *   - tek karakterlik ad
 *   - çok büyük tutar (binlik ayraçlar sütunu taşırır mı)
 *   - sıfır tutar
 *   - çok sayıda ürün etiketi (hücre yüksekliği patlar mı)
 *   - Türkçe büyük harf İ/ı (sıralama ve kırpma)
 */
import http from 'node:http';

const PORT = Number(process.env.PORT_SAHTE || 8787);
const ADET = Number(process.env.MUSTERI_SAYISI || 5000);

const SEHIR = ['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Kocaeli', 'Konya', 'Gaziantep', 'Adana', 'Kayseri',
  'Mersin', 'Diyarbakır', 'Şanlıurfa', 'Eskişehir', 'Samsun', 'Denizli', 'Trabzon', 'Malatya'];
const ILCE = ['Merkez', 'Nilüfer', 'Çankaya', 'Kadıköy', 'Bornova', 'Gebze', 'Selçuklu', 'Şehitkamil', 'Osmangazi'];
const DURUM = ['Beklemede', 'Görüşülüyor', 'Teklif Verildi', 'Kazanıldı', 'Kaybedildi', 'Çalışılıyor'];
const SEVIYE = ['Düşük', 'Orta', 'Yüksek'];
const PAZAR = ['Otomotiv', 'Gıda', 'Tekstil', 'İnşaat', 'Enerji', 'Lojistik', 'Sağlık', 'Kimya', 'Madencilik', 'Ambalaj'];
const UYGULAMA = ['Depo Yönetimi', 'Üretim Takibi', 'Filo', 'Bakım Planlama', 'Kalite Kontrol', 'Enerji İzleme'];
const KISI = ['Ayşe Yıldız', 'Mehmet Kaya', 'Elif Demir', 'Burak Şahin', 'Zeynep Arslan', 'Can Öztürk', 'İpek Aydın'];
const URUN = ['Sensör', 'PLC', 'Sürücü', 'Panel', 'Yazılım Lisansı', 'Servo Motor', 'HMI', 'Röle'];
const RAKIP = ['Siemens', 'Schneider', 'Rockwell', 'Omron', 'Mitsubishi', ''];

const ON = ['Anadolu', 'Ege', 'Marmara', 'Toros', 'Kuzey', 'Öz', 'Yıldız', 'Deniz', 'Akdeniz', 'Başak',
  'Çukurova', 'İç Anadolu', 'Trakya', 'Karadeniz', 'Fırat'];
const ORTA = ['Makine', 'Endüstri', 'Teknoloji', 'Metal', 'Otomasyon', 'Enerji', 'Plastik', 'Tekstil', 'Kimya'];
const SON = ['A.Ş.', 'Ltd. Şti.', 'San. Tic. A.Ş.', 'Holding A.Ş.'];

const gun = (k) => { const t = new Date(); t.setDate(t.getDate() + k); return t.toISOString().slice(0, 10); };

const UZUN_AD = 'Anadolu Endüstriyel Otomasyon ve Makine Sanayi Ticaret Limited Şirketi Bursa Organize Sanayi Bölgesi Şubesi';

const MUSTERILER = Array.from({ length: ADET }, (_, i) => {
  /* Her 100 kayıttan biri uç değer. */
  const uc = i % 100;
  return {
    id: 'm' + (i + 1),
    company_name: uc === 7 ? UZUN_AD : uc === 13 ? 'X' : ON[i % ON.length] + ' ' + ORTA[(i * 3) % ORTA.length] + ' ' + SON[i % SON.length],
    market: uc === 21 ? '' : PAZAR[i % PAZAR.length],
    application: UYGULAMA[i % UYGULAMA.length],
    city: uc === 21 ? '' : SEHIR[i % SEHIR.length],
    district: ILCE[i % ILCE.length],
    website: uc === 31 ? '' : 'www.' + ON[i % ON.length].toLowerCase().replace(/[^a-z]/g, '') + i + '.com.tr',
    status: DURUM[i % DURUM.length],
    contact_info: { phone: '0212 555 ' + String(1000 + (i % 9000)), email: 'info@firma' + i + '.com.tr' },
    contacts: [{ name: KISI[i % KISI.length], title: 'Satın Alma Müdürü', phone: '0532 555 ' + String(2000 + (i % 8000)) }],
    potential_value: uc === 3 ? 128500000 : uc === 41 ? 0 : [45000, 120000, 380000, 75000, 260000, 890000][i % 6],
    next_followup_date: i % 3 === 0 ? gun((i % 21) - 7) : '',
    assigned_to: uc === 21 ? '' : KISI[(i + 2) % KISI.length],
    competitor: RAKIP[i % RAKIP.length],
    partner: '',
    potential_level: SEVIYE[i % SEVIYE.length],
    products: uc === 17 ? URUN : [URUN[i % URUN.length], URUN[(i + 2) % URUN.length]],
    description: 'Mevcut hattın modernizasyonu için görüşme sürüyor.',
    notes: '', notes_list: [], documents: [],
    tags: i % 4 === 0 ? ['öncelikli'] : [],
    is_followup: i % 3 === 0,
    created_at: new Date(Date.now() - (i % 900) * 86400000).toISOString(),
    updated_at: new Date(Date.now() - (i % 60) * 86400000).toISOString(),
    ai_filled: {},
  };
});

const ZIYARETLER = Array.from({ length: Math.min(1200, ADET / 4) }, (_, i) => ({
  id: 'z' + (i + 1), customer_id: 'm' + ((i % ADET) + 1),
  company_name: MUSTERILER[i % ADET].company_name,
  visit_date: gun(-(i % 400)), visit_type: ['Yerinde', 'Online', 'Telefon'][i % 3],
  notes: 'Numune teslim edildi, teknik ekiple değerlendirilecek.',
  created_by: KISI[i % KISI.length],
  next_followup_date: i % 2 ? gun(i % 30) : '',
  created_at: new Date(Date.now() - (i % 400) * 86400000).toISOString(),
}));

const ARAMALAR = Array.from({ length: Math.min(900, ADET / 5) }, (_, i) => ({
  id: 'a' + (i + 1), customer_id: 'm' + ((i % ADET) + 1),
  company_name: MUSTERILER[i % ADET].company_name,
  call_date: gun(-(i % 300)), duration: 5 + (i % 55),
  notes: 'Fiyat listesi talep edildi.', created_by: KISI[(i + 1) % KISI.length],
}));

const say = (alan) => {
  const m = {};
  for (const x of MUSTERILER) { const k = x[alan] || '—'; m[k] = (m[k] || 0) + 1; }
  return Object.entries(m).map(([_id, count]) => ({ _id, count, name: _id, value: count }));
};

const YOLLAR = [
  ['GET', /^\/api\/auth\/me$/, () => ({ id: 'u1', email: 'hakan@crmaster.net', name: 'Hakan Önel', role: 'admin', picture: '' })],
  /* Gerçek arka uçtaki /customers/lookup ile aynı: yalnızca id + ad. */
  ['GET', /^\/api\/customers\/lookup$/, () => ({
    data: MUSTERILER.map((m) => ({ id: m.id, company_name: m.company_name })),
    total: MUSTERILER.length,
  })],
  ['GET', /^\/api\/customers\/filter-options$/, () => ({
    cities: [...new Set(MUSTERILER.map((m) => m.city))].filter(Boolean),
    markets: [...new Set(MUSTERILER.map((m) => m.market))].filter(Boolean),
    statuses: DURUM, potential_levels: SEVIYE,
    assigned_to: [...new Set(MUSTERILER.map((m) => m.assigned_to))].filter(Boolean),
  })],
  ['GET', /^\/api\/customers\/([^/]+)\/similar$/, () => MUSTERILER.slice(0, 4)],
  ['GET', /^\/api\/customers\/([^/]+)$/, (m) => MUSTERILER.find((x) => x.id === m[1]) || MUSTERILER[0]],
  /* SUNUCU TARAFI SAYFALAMA — gerçek uçtaki sözleşmenin aynısı
     ({data, total, page, limit, total_pages}, bkz. backend/server.py).
     İlk sürüm page/limit'i yok sayıp 3150 kaydın hepsini gönderiyordu ve
     Müşteriler ekranı kilitleniyordu; uygulamanın değil stub'ın hatasıydı.
     Süzme ve sıralama da burada, çünkü uygulama onları sunucudan bekliyor. */
  ['GET', /^\/api\/customers$/, (m, q) => {
    const kucult = (s) => String(s || '').toLocaleLowerCase('tr');
    const ara = kucult(q.get('search'));
    const alanEsle = (x, ad) => {
      const v = q.get(ad);
      return !v || v === 'all' || x[ad] === v;
    };
    let liste = MUSTERILER.filter((x) =>
      alanEsle(x, 'market') && alanEsle(x, 'status') && alanEsle(x, 'city') &&
      alanEsle(x, 'application') && alanEsle(x, 'competitor') && alanEsle(x, 'partner') &&
      (!ara || kucult(x.company_name).includes(ara) || kucult(x.city).includes(ara) ||
        kucult(x.market).includes(ara)));

    const alan = q.get('sort_by') || 'created_at';
    const yon = q.get('sort_order') === 'asc' ? 1 : -1;
    liste = [...liste].sort((a, b) => {
      const x = a[alan], y = b[alan];
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * yon;
      return String(x ?? '').localeCompare(String(y ?? ''), 'tr') * yon;
    });

    const limit = Math.max(1, Number(q.get('limit') || 50));
    const sayfa = Math.max(1, Number(q.get('page') || 1));
    const toplamSayfa = Math.max(1, Math.ceil(liste.length / limit));
    return {
      data: liste.slice((sayfa - 1) * limit, sayfa * limit),
      total: liste.length,
      page: sayfa,
      limit,
      total_pages: toplamSayfa,
    };
  }],
  ['GET', /^\/api\/visits$/, () => ZIYARETLER],
  ['GET', /^\/api\/calls$/, () => ARAMALAR],
  ['GET', /^\/api\/followups$/, () => ({
    customers: MUSTERILER.filter((m) => m.is_followup).slice(0, 60),
    visits: ZIYARETLER.filter((z) => z.next_followup_date).slice(0, 40),
  })],
  ['GET', /^\/api\/activity-feed$/, () => ZIYARETLER.slice(0, 40).map((z, i) => ({
    id: 'af' + i, type: ['visit', 'call', 'note', 'status'][i % 4],
    customer_id: z.customer_id, title: z.company_name,
    subtitle: ['ziyaret eklendi', 'arama kaydedildi', 'not düşüldü', 'durum güncellendi'][i % 4],
    timestamp: z.created_at,
  }))],
  ['GET', /^\/api\/stats\/distribution/, (m, q) => ({ entries: say(q.get('field') || 'status') })],
  ['GET', /^\/api\/stats\/segment/, () => MUSTERILER.slice(0, 80)],
  ['GET', /^\/api\/stats/, () => ({
    total_customers: MUSTERILER.length, total_visits: ZIYARETLER.length, total_calls: ARAMALAR.length,
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
  ['GET', /^\/api\/kanban\/group-fields$/, () => [
    { value: 'status', label: 'Durum' }, { value: 'potential_level', label: 'Potansiyel' },
    { value: 'city', label: 'Şehir' }, { value: 'assigned_to', label: 'Sorumlu' }, { value: 'market', label: 'Market' },
  ]],
  ['GET', /^\/api\/kanban\/customers$/, (m, q) => {
    const alan = ['status', 'potential_level', 'city', 'assigned_to', 'market'].includes(q.get('group_by')) ? q.get('group_by') : 'status';
    /* Gerçek arka uç yalnızca kart alanlarını seçiyor (server.py). Tam
       kaydı döndürmek ölçümü yanıltıyordu: 4 MB yerine ~700 KB. */
    const KART_ALAN = ['id', 'company_name', 'market', 'application', 'city', 'status',
      'potential_level', 'assigned_to', 'contact_info', 'products', 'competitor', 'partner'];
    const s = {};
    for (const x of MUSTERILER) {
      const k = x[alan] || '—';
      const kart = {};
      for (const f of KART_ALAN) kart[f] = x[f];
      (s[k] ||= []).push(kart);
    }
    return s;
  }],
  ['GET', /^\/api\/process\/boards$/, () => [{ id: 'p1', name: 'Teklif Süreci', columns: DURUM.map((d, i) => ({ id: 'c' + i, name: d })) }]],
  ['GET', /^\/api\/filters$/, () => [{ id: 'f1', name: 'Yüksek potansiyel', criteria: { potential_level: 'Yüksek' } }]],
  ['GET', /^\/api\/users\/me\/notifications$/, () => ZIYARETLER.slice(0, 12).map((z, i) => ({
    id: 'n' + i, title: z.company_name, message: 'Takip tarihi yaklaşıyor', is_read: i > 5, created_at: z.created_at,
  }))],
  ['GET', /^\/api\/team-members/, () => KISI.map((k, i) => ({ id: 't' + i, name: k, email: 'x' + i + '@crmaster.net', customer_count: Math.round(ADET / KISI.length) }))],
  ['GET', /^\/api\/users$/, () => KISI.slice(0, 5).map((k, i) => ({ id: 'u' + i, name: k, email: 'x' + i + '@crmaster.net', role: i ? 'user' : 'admin' }))],
  ['GET', /^\/api\/allowed-users$/, () => []],
  ['GET', /^\/api\/backups\/config$/, () => ({ enabled: false, schedule: 'daily' })],
];

http.createServer((req, res) => {
  const yol = decodeURIComponent((req.url || '').split('?')[0]);
  const sorgu = new URLSearchParams((req.url || '').split('?')[1] || '');
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
     "Network Error" olarak görüyor. */
  const govdeOku = () => new Promise((coz) => {
    if (req.method === 'GET' || req.method === 'HEAD') return coz(null);
    let ham = '';
    req.on('data', (p) => { ham += p; });
    req.on('end', () => { try { coz(ham ? JSON.parse(ham) : null); } catch { coz(null); } });
    req.on('error', () => coz(null));
  });

  govdeOku().then((istekGovdesi) => {
    let govde = null;
    for (const [y, kalip, uret] of YOLLAR) {
      if (req.method !== y) continue;
      const m = kalip.exec(yol);
      if (m) { govde = uret(m, sorgu, istekGovdesi); break; }
    }
    if (govde === null) govde = /\/(customers|visits|calls|users|options|filters|boards|notifications|suggestions|duplicates)/.test(yol) ? [] : {};

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(govde));
  });
}).listen(PORT, () => console.log('hacim testi API: http://localhost:' + PORT + '  (' + ADET + ' musteri)'));
