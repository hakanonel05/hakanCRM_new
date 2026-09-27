import { useState, useCallback, useEffect } from "react";
import axios from "axios";
import { Loader2, Printer, BarChart3 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

// Grafik kütüphanesi kullanılmıyor: her dağılım satır içi çubukla
// gösteriliyor. Halka grafik yanındaki tabloyla aynı veriyi tekrarlıyor,
// okumak için renk-dilim-satır eşleştirmesi gerektiriyordu.

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/* Analiz raporu: "şu tarihler arasında kaç arama yapıldı", "rakiplerin
 * payı ne", "F&B marketinde rakip dağılımı nasıl".
 *
 * Mevcut Raporlama bir sütun seçici — düz Excel listesi döküyor. Bu ise
 * soruların cevabını veriyor.
 *
 * PDF: tarayıcının yazdırma penceresinden "PDF olarak kaydet". Ayrı bir
 * kitaplık eklenmedi, çünkü sunucuda PDF üretmek Türkçe karakterler için
 * depoya yazı tipi dosyası koymayı gerektiriyordu (ş, ğ, İ, ı gömülü font
 * olmadan bozuk çıkıyor) ve grafikleri sıfırdan çizmek gerekiyordu.
 * Tarayıcı ikisini de zaten doğru yapıyor. */

/* Durum değerleri sabit bir liste (arka uçtaki KANBAN_STATUSES ile aynı);
   filter-options bunu döndürmüyor. */
/* Başlıkta hangi süzgecin etkili olduğu yazıyor; raporu birine
   gönderdiğinde neyin süzüldüğü belli olsun. */
const SUZGEC_ADLARI = {
  market: "Market", city: "Şehir", district: "İlçe", status: "Durum",
  potential_level: "Potansiyel", competitor: "Rakip", partner: "Partner",
  assigned_to: "Takip Eden",
};

const DURUMLAR = ["Beklemede", "İletişimde", "Teklif Verildi", "Çalışılıyor",
                  "Kazanıldı", "Kaybedildi"];

const bugun = () => new Date().toISOString().slice(0, 10);
const yilBasi = () => `${new Date().getFullYear()}-01-01`;

/* Süzgeç kutusu. Yerel <select> bilerek: yüzlerce şehir olduğunda harfle
   yazarak atlamayı tarayıcı zaten yapıyor, özel bir bileşen bunu
   taklit etmek zorunda kalırdı. */
const Secim = ({ etiket, deger, secenekler, onChange, testid }) => (
  <div>
    <Label className="text-xs">{etiket}</Label>
    <select
      value={deger}
      onChange={(e) => onChange(e.target.value)}
      data-testid={testid}
      className="h-9 w-40 rounded-md border border-input bg-background px-2 text-sm"
    >
      <option value="">Tümü</option>
      {(secenekler || []).map((x) => (
        <option key={x} value={x}>{x}</option>
      ))}
    </select>
  </div>
);

const Kart = ({ baslik, deger, alt }) => (
  <div className="rounded-lg border border-border bg-card p-3">
    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{baslik}</p>
    <p className="mt-1 text-2xl font-bold text-foreground">{deger}</p>
    {alt && <p className="text-[11px] text-muted-foreground">{alt}</p>}
  </div>
);

const Bolum = ({ baslik, children, not: notMetni }) => (
  <section className="mb-6 break-inside-avoid">
    <h3 className="mb-2 border-b border-border pb-1 text-sm font-semibold text-foreground">
      {baslik}
    </h3>
    {notMetni && <p className="mb-2 text-[11px] text-muted-foreground">{notMetni}</p>}
    {children}
  </section>
);

/* Satır içi çubuklu tablo.
 *
 * Önceden her bölümde ayrı bir grafik ve ayrı bir tablo vardı; grafik
 * 360px'e sıkışıyor, tablo sağ kenara itiliyor, ortada koca bir boşluk
 * kalıyordu. Çubuğu satırın içine almak ikisini tek yerde birleştiriyor:
 * hem yarı yer kaplıyor hem de göz karşılaştırmayı aynı satırda yapıyor.
 */
const sayiBicim = (v) => Number(v || 0).toLocaleString("tr-TR");

/* k€ değerleri: ondalık yalnızca gerekiyorsa. "1.250" okunur, "1.250,0" gürültü. */
const kE = (v) => {
  const n = Number(v || 0);
  return n.toLocaleString("tr-TR", { maximumFractionDigits: n < 10 ? 1 : 0 });
};

const CubukluTablo = ({
  satirlar,
  birimBaslik = "Müşteri",
  // Çubuğu hangi alan sürüyor: adet için "sayi", büyüklük için "deger"
  alan = "sayi",
  bicim = sayiBicim,
  // İsteğe bağlı ikinci sütun: büyüklüğün yanında müşteri adedi
  ikinciBaslik = "",
  ikinciAlan = "",
}) => {
  const enBuyuk = Math.max(1, ...satirlar.map((d) => Number(d[alan]) || 0));
  return (
    /* Genişlik sınırı: tam genişlikte çubuk devasa bir şeride dönüşüyor
       ve yüzde sütunu sayfanın öbür ucuna kaçıyordu. İki sütunlu
       ızgaralarda sütun zaten bundan dar, orada etkisi yok. */
    <table className="w-full max-w-[720px] text-xs">
      <thead>
        <tr className="border-b border-border text-left text-muted-foreground">
          {/* Ad ve sayı YAN YANA dursun: w-[1%]+nowrap sütunu içeriğe
              göre daraltıyor, artan genişliği çubuk sütunu yutuyor.
              Önce ad sütunu tüm boşluğu alıyor, sayı satırın öbür ucuna
              düşüyor ve göz ikisini birleştiremiyordu. */}
          <th className="w-[1%] whitespace-nowrap py-1 pr-3 font-medium">Ad</th>
          <th className="w-[1%] whitespace-nowrap py-1 pr-1 text-right font-medium">
            {birimBaslik}
          </th>
          {ikinciAlan && (
            <th className="w-[1%] whitespace-nowrap py-1 pl-3 text-right font-medium">
              {ikinciBaslik}
            </th>
          )}
          <th className="py-1 font-medium" />
          <th className="w-[1%] whitespace-nowrap py-1 pl-2 text-right font-medium">%</th>
        </tr>
      </thead>
      <tbody>
        {satirlar.map((d, i) => (
          <tr key={d.ad} className="border-b border-border/40">
            <td className="max-w-[220px] truncate py-1 pr-3 font-medium" title={d.ad}>
              {d.ad}
            </td>
            <td className="py-1 pr-1 text-right tabular-nums">{bicim(d[alan])}</td>
            {ikinciAlan && (
              <td className="py-1 pl-3 text-right tabular-nums text-muted-foreground">
                {sayiBicim(d[ikinciAlan])}
              </td>
            )}
            <td className="w-full py-1 pl-3 pr-2">
              <div className="h-2.5 rounded-sm bg-muted">
                <div
                  className="h-2.5 rounded-sm"
                  /* Tek renk: satırda bilgiyi çubuğun UZUNLUĞU taşıyor,
                     rengi değil — adı zaten solda yazıyor. Satır başına
                     ayrı renk vermek gökkuşağı gürültüsü olurdu (projenin
                     grafik renk notuna bakın: index.css --chart-1..5).
                     Halka grafikte renk gerekli, çünkü orada dilimi
                     ayıran tek şey o. */
                  style={{
                    width: `${Math.max(2, ((Number(d[alan]) || 0) / enBuyuk) * 100)}%`,
                    backgroundColor: "hsl(var(--chart-2))",
                  }}
                />
              </div>
            </td>
            <td className="py-1 pl-2 text-right tabular-nums text-muted-foreground">
              %{d.yuzde}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default function AnalyticsReport() {
  const [baslangic, setBaslangic] = useState(yilBasi);
  const [bitis, setBitis] = useState(bugun);
  /* Süzgeçler tek nesnede: hepsi birlikte çalışıyor (VE mantığı), yani
     "İstanbul" + "F&B" seçilince İstanbul'daki F&B müşterileri kalıyor. */
  const [suzgec, setSuzgec] = useState({
    market: "", sehir: "", durum: "", rakip: "", takip_eden: "",
  });
  const [secenekler, setSecenekler] = useState({});
  const [veri, setVeri] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState("");

  const suzgecAyarla = (alan, deger) =>
    setSuzgec((o) => ({ ...o, [alan]: deger }));

  /* Süzgeç kutularının içeriği gerçek veriden geliyor; elle yazılan bir
     şehir adı yanlış yazılırsa rapor boş çıkardı. */
  useEffect(() => {
    axios.get(`${API}/customers/filter-options`)
      .then(({ data }) => setSecenekler(data || {}))
      .catch(() => setSecenekler({}));
  }, []);

  const olustur = useCallback(async () => {
    setYukleniyor(true);
    setHata("");
    try {
      const { data } = await axios.get(`${API}/reports/analytics`, {
        params: { baslangic, bitis, ...suzgec },
      });
      setVeri(data);
    } catch (e) {
      setHata(e?.response?.data?.detail || "Rapor oluşturulamadı.");
      setVeri(null);
    } finally {
      setYukleniyor(false);
    }
  }, [baslangic, bitis, suzgec]);

  /* ANLIK YENİLEME: süzgeç değişince rapor kendiliğinden yeniden
     hesaplanıyor, düğmeye basmak gerekmiyor. 350 ms bekleme, arka arkaya
     iki seçimde iki istek atılmasını önlüyor. */
  useEffect(() => {
    const t = setTimeout(olustur, 350);
    return () => clearTimeout(t);
  }, [olustur]);

  return (
    <div>
      {/* Yazdırma biçimi: ekran kontrolleri çıktıya girmesin, kartlar
          sayfa ortasından bölünmesin. */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #analiz-raporu, #analiz-raporu * { visibility: visible; }
          #analiz-raporu { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
          .yazdirma-disi { display: none !important; }
          .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
          @page { margin: 14mm; }
        }
      `}</style>

      <div className="yazdirma-disi mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
        <div>
          <Label className="text-xs">Başlangıç</Label>
          <Input type="date" value={baslangic} onChange={(e) => setBaslangic(e.target.value)}
                 className="h-9 w-40" data-testid="analiz-baslangic" />
        </div>
        <div>
          <Label className="text-xs">Bitiş</Label>
          <Input type="date" value={bitis} onChange={(e) => setBitis(e.target.value)}
                 className="h-9 w-40" data-testid="analiz-bitis" />
        </div>
        <Secim etiket="Şehir" deger={suzgec.sehir} secenekler={secenekler.city}
               onChange={(v) => suzgecAyarla("sehir", v)} testid="analiz-sehir" />
        <Secim etiket="Market" deger={suzgec.market} secenekler={secenekler.market}
               onChange={(v) => suzgecAyarla("market", v)} testid="analiz-market" />
        <Secim etiket="Durum" deger={suzgec.durum} secenekler={DURUMLAR}
               onChange={(v) => suzgecAyarla("durum", v)} testid="analiz-durum" />
        <Secim etiket="Rakip" deger={suzgec.rakip} secenekler={secenekler.competitor}
               onChange={(v) => suzgecAyarla("rakip", v)} testid="analiz-rakip" />
        <Secim etiket="Takip Eden" deger={suzgec.takip_eden} secenekler={secenekler.assigned_to}
               onChange={(v) => suzgecAyarla("takip_eden", v)} testid="analiz-takip" />

        {Object.values(suzgec).some(Boolean) && (
          <Button
            variant="ghost"
            onClick={() => setSuzgec({ market: "", sehir: "", durum: "", rakip: "", takip_eden: "" })}
            data-testid="analiz-temizle"
          >
            Süzgeçleri temizle
          </Button>
        )}
        {yukleniyor && (
          <span className="flex items-center gap-1 pb-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> güncelleniyor
          </span>
        )}
        {veri && (
          <Button variant="outline" onClick={() => window.print()} data-testid="analiz-yazdir">
            <Printer className="mr-1.5 h-4 w-4" />
            PDF olarak kaydet
          </Button>
        )}
      </div>

      {hata && <p className="text-sm text-status-danger-fg">{hata}</p>}

      {!veri && !yukleniyor && !hata && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Tarih aralığını seçip "Rapor Oluştur"a bas.
        </p>
      )}

      {veri && (
        <div id="analiz-raporu">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-foreground">CRMaster Analiz Raporu</h2>
            <p className="text-xs text-muted-foreground">
              {veri.aralik.baslangic || "başlangıç yok"} – {veri.aralik.bitis || "bugün"}
              {veri.suzgecler && Object.keys(veri.suzgecler).length > 0
                ? " · " + Object.entries(veri.suzgecler)
                    .map(([k, v]) => `${SUZGEC_ADLARI[k] || k}: ${v}`).join(" · ")
                : " · Süzgeç yok"}
              {" · "}{new Date().toLocaleString("tr-TR")}
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kart baslik="Arama" deger={veri.aramalar.toplam} alt="seçilen aralıkta" />
            <Kart baslik="Müşteri" deger={veri.kapsam.musteri_sayisi}
                  alt={veri.market ? `${veri.market} marketinde` : "toplam"} />
            <Kart baslik="Yeni müşteri" deger={veri.kapsam.yeni_musteri} alt="aralıkta eklenen" />
            <Kart
              baslik="Toplam potansiyel"
              deger={`${kE(veri.buyukluk?.toplam)} k€`}
              /* Kaç müşteride değer GİRİLMEMİŞ olduğu burada yazıyor:
                 bu sayı yüksekse toplam pazarı değil, yalnızca girilmiş
                 olanları anlatır ve öyle okunmalı. */
              alt={veri.buyukluk?.bilinmeyen_musteri
                ? `${veri.buyukluk.bilinmeyen_musteri} müşteride değer girilmemiş`
                : "tüm müşterilerde değer girili"}
            />
          </div>

          <Bolum
            baslik={`Aramalar (${veri.aramalar.toplam})`}
            not="Tarih olarak kayıt tarihi esas alınıyor; arama tarihi girilmemiş kayıtlar da rapora giriyor."
          >
            {veri.aramalar.toplam === 0 ? (
              <p className="text-xs text-muted-foreground">Bu aralıkta arama kaydı yok.</p>
            ) : (
              <div>
                {/* Halka grafik kaldırıldı: yanındaki tabloyla AYNI veriyi
                    gösteriyordu ve okumak için rengi dilime, dilimi satıra
                    eşleştirmek gerekiyordu. Oran bilgisini çubuk ve yüzde
                    sütunu zaten taşıyor. */}
                <div className="grid gap-x-8 gap-y-4 lg:grid-cols-2">
                  <div className="break-inside-avoid">
                    <p className="mb-1 text-xs font-semibold">Arama sonucuna göre</p>
                    <CubukluTablo satirlar={veri.aramalar.sonuc} birimBaslik="Adet" />
                  </div>
                  <div className="break-inside-avoid">
                    <p className="mb-1 text-xs font-semibold">Arayana göre</p>
                    <CubukluTablo satirlar={veri.aramalar.arayan} birimBaslik="Adet" />
                  </div>
                </div>
                  {/* Boş "Arayan" alanı bu raporun en büyük zayıflığı;
                      gizlemek yerine ne yapılacağıyla birlikte söyleniyor. */}
                  {veri.aramalar.arayani_bos > 0 && (
                    <p className="mt-2 text-[11px] text-status-warning-fg">
                      {veri.aramalar.arayani_bos} aramada "Arayan" alanı boş
                      ({Math.round(veri.aramalar.arayani_bos * 100 / veri.aramalar.toplam)}%).
                      Kim aradığının raporda çıkması için arama kaydederken
                      bu alanın doldurulması gerekiyor. Farklı yazımlar
                      (Furkan / Furkan ÇELİK) aynı kişide birleştiriliyor.
                    </p>
                  )}
              </div>
            )}
          </Bolum>

          <Bolum
            baslik="Rakip dağılımı"
            not={`Yüzdeler, rakibi girilmiş ${veri.rakipler.rakibi_bilinen} kayıt üzerinden. ${veri.rakipler.rakibi_bos} kayıtta rakip alanı boş.`}
          >
            {veri.rakipler.dagilim.length === 0 ? (
              <p className="text-xs text-muted-foreground">Rakip bilgisi girilmiş kayıt yok.</p>
            ) : (
              <CubukluTablo satirlar={veri.rakipler.dagilim} />
            )}
          </Bolum>

          {veri.buyukluk && (
            <Bolum
              baslik="Potansiyel büyüklük (k€)"
              not={
                veri.buyukluk.bilinmeyen_musteri
                  ? `Toplam ${kE(veri.buyukluk.toplam)} k€, değeri girilmiş ${veri.buyukluk.bilinen_musteri} müşteriden. ` +
                    `${veri.buyukluk.bilinmeyen_musteri} müşteride potansiyel girilmemiş, bu yüzden gerçek büyüklük daha yüksek olabilir. ` +
                    `Değeri girilmiş müşteri başına ortalama ${kE(veri.buyukluk.ortalama)} k€.`
                  : `Toplam ${kE(veri.buyukluk.toplam)} k€, müşteri başına ortalama ${kE(veri.buyukluk.ortalama)} k€.`
              }
            >
              {veri.buyukluk.toplam <= 0 ? (
                <p className="text-xs text-muted-foreground">
                  Bu kapsamdaki hiçbir müşteride potansiyel değeri girilmemiş.
                  Müşteriler sayfasındaki "Potansiyel (k€)" sütununa tıklayıp
                  değer girebilirsiniz.
                </p>
              ) : (
                <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">
                  <div className="break-inside-avoid">
                    <h4 className="mb-1 text-xs font-semibold text-foreground">Markete göre</h4>
                    <CubukluTablo satirlar={veri.buyukluk.market} alan="deger"
                      bicim={kE} birimBaslik="k€" ikinciBaslik="Müşteri" ikinciAlan="musteri" />
                  </div>
                  <div className="break-inside-avoid">
                    <h4 className="mb-1 text-xs font-semibold text-foreground">Şehre göre</h4>
                    <CubukluTablo satirlar={veri.buyukluk.sehir} alan="deger"
                      bicim={kE} birimBaslik="k€" ikinciBaslik="Müşteri" ikinciAlan="musteri" />
                  </div>
                  <div className="break-inside-avoid">
                    <h4 className="mb-1 text-xs font-semibold text-foreground">
                      Rakibe göre
                    </h4>
                    {/* Potansiyel eşit bölünüyor, böylece kırılımın toplamı
                        kapsamın toplamına eşit kalıyor ve "ABB ne kadar
                        potansiyel yapıyor" sorusu şişmiyor. */}
                    <p className="mb-1 text-[10px] text-muted-foreground">
                      Birden fazla rakip varsa potansiyel eşit bölünüyor
                      (200 k€ · 2 rakip → her birine 100 k€). Müşteri sayısı
                      bölünmüyor.
                    </p>
                    <CubukluTablo satirlar={veri.buyukluk.rakip} alan="deger"
                      bicim={kE} birimBaslik="k€" ikinciBaslik="Müşteri" ikinciAlan="musteri" />
                  </div>
                  <div className="break-inside-avoid">
                    <h4 className="mb-1 text-xs font-semibold text-foreground">Partnere göre</h4>
                    <p className="mb-1 text-[10px] text-muted-foreground">
                      Birden fazla partner varsa potansiyel eşit bölünüyor
                      (200 k€ · ADS + Halıcı → her birine 100 k€).
                    </p>
                    <CubukluTablo satirlar={veri.buyukluk.partner || []} alan="deger"
                      bicim={kE} birimBaslik="k€" ikinciBaslik="Müşteri" ikinciAlan="musteri" />
                  </div>
                  <div className="break-inside-avoid">
                    <h4 className="mb-1 text-xs font-semibold text-foreground">Takip edene göre</h4>
                    <CubukluTablo satirlar={veri.buyukluk.takip_eden} alan="deger"
                      bicim={kE} birimBaslik="k€" ikinciBaslik="Müşteri" ikinciAlan="musteri" />
                  </div>
                </div>
              )}
            </Bolum>
          )}

          {/* Market kırılımları İKİ SÜTUNDA.
              Önceden her market tam sayfa genişliği kaplıyordu; 5-8 satırlık
              veri için bir ekran boyu yer demekti ve PDF'te sayfa sayısını
              gereksiz artırıyordu. Ayrı çubuk grafikler kaldırıldı, çubuk
              artık satırın içinde. */}
          {!veri.market && veri.market_rakip.length > 0 && (
            <section className="mb-6">
              <h3 className="mb-3 border-b border-border pb-1 text-sm font-semibold text-foreground">
                Marketlere göre rakip dağılımı
              </h3>
              <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">
                {veri.market_rakip.map((mr) => (
                  <div key={mr.market} className="break-inside-avoid">
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <h4 className="text-xs font-semibold text-foreground">{mr.market}</h4>
                      <span className="text-[10px] text-muted-foreground">
                        {mr.musteri_sayisi} müşteri · {kE(mr.buyukluk)} k€ · {mr.rakibi_bilinen} rakipli
                      </span>
                    </div>
                    {mr.dagilim.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">Rakip bilgisi yok.</p>
                    ) : (
                      <CubukluTablo satirlar={mr.dagilim} />
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
