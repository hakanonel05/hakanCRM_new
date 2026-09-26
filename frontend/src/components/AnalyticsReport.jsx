import { useState, useCallback } from "react";
import axios from "axios";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Doughnut, Bar } from "react-chartjs-2";
import { Loader2, Printer, BarChart3 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

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

const RENKLER = [
  "#1f2937", "#ea580c", "#0369a1", "#15803d", "#a16207",
  "#7c3aed", "#be123c", "#0f766e", "#9a3412", "#4338ca",
];

const bugun = () => new Date().toISOString().slice(0, 10);
const yilBasi = () => `${new Date().getFullYear()}-01-01`;

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

const Tablo = ({ basliklar, satirlar }) => (
  <table className="w-full text-xs">
    <thead>
      <tr className="border-b border-border text-left text-muted-foreground">
        {basliklar.map((b, i) => (
          <th key={b} className={`py-1 font-medium ${i ? "text-right" : ""}`}>{b}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {satirlar.map((s, i) => (
        <tr key={i} className="border-b border-border/50">
          {s.map((h, j) => (
            <td key={j} className={`py-1 ${j ? "text-right tabular-nums" : "font-medium"}`}>{h}</td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

export default function AnalyticsReport() {
  const [baslangic, setBaslangic] = useState(yilBasi);
  const [bitis, setBitis] = useState(bugun);
  const [market, setMarket] = useState("");
  const [veri, setVeri] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState("");

  const olustur = useCallback(async () => {
    setYukleniyor(true);
    setHata("");
    try {
      const { data } = await axios.get(`${API}/reports/analytics`, {
        params: { baslangic, bitis, market: market.trim() },
      });
      setVeri(data);
    } catch (e) {
      setHata(e?.response?.data?.detail || "Rapor oluşturulamadı.");
      setVeri(null);
    } finally {
      setYukleniyor(false);
    }
  }, [baslangic, bitis, market]);

  const halka = (dagilim) => ({
    labels: dagilim.map((d) => d.ad),
    datasets: [{
      data: dagilim.map((d) => d.sayi),
      backgroundColor: dagilim.map((_, i) => RENKLER[i % RENKLER.length]),
      borderWidth: 0,
    }],
  });

  const halkaAyar = {
    plugins: {
      legend: { position: "right", labels: { boxWidth: 10, font: { size: 10 } } },
    },
    // Yazdırırken canvas'ın sayfaya sığması için oranı sabitliyoruz.
    maintainAspectRatio: true,
    animation: false,
  };

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
        <div>
          <Label className="text-xs">Market (boş = tümü)</Label>
          <Input value={market} onChange={(e) => setMarket(e.target.value)}
                 placeholder="örn. F&B" className="h-9 w-44" data-testid="analiz-market" />
        </div>
        <Button onClick={olustur} disabled={yukleniyor} data-testid="analiz-olustur">
          {yukleniyor ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      : <BarChart3 className="mr-1.5 h-4 w-4" />}
          Rapor Oluştur
        </Button>
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
              {veri.market ? ` · Market: ${veri.market}` : " · Tüm marketler"}
              {" · "}{new Date().toLocaleString("tr-TR")}
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kart baslik="Arama" deger={veri.aramalar.toplam} alt="seçilen aralıkta" />
            <Kart baslik="Müşteri" deger={veri.kapsam.musteri_sayisi}
                  alt={veri.market ? `${veri.market} marketinde` : "toplam"} />
            <Kart baslik="Yeni müşteri" deger={veri.kapsam.yeni_musteri} alt="aralıkta eklenen" />
            <Kart baslik="Rakibi bilinen" deger={veri.rakipler.rakibi_bilinen}
                  alt={`${veri.rakipler.rakibi_bos} kayıtta boş`} />
          </div>

          <Bolum
            baslik={`Aramalar (${veri.aramalar.toplam})`}
            not="Tarih olarak kayıt tarihi esas alınıyor; arama tarihi girilmemiş kayıtlar da rapora giriyor."
          >
            {veri.aramalar.toplam === 0 ? (
              <p className="text-xs text-muted-foreground">Bu aralıkta arama kaydı yok.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="max-w-[320px]">
                  <Doughnut data={halka(veri.aramalar.sonuc)} options={halkaAyar} />
                </div>
                <div>
                  <Tablo
                    basliklar={["Sonuç", "Adet", "%"]}
                    satirlar={veri.aramalar.sonuc.map((d) => [d.ad, d.sayi, `%${d.yuzde}`])}
                  />
                  <p className="mt-3 mb-1 text-xs font-semibold">Arayana göre</p>
                  <Tablo
                    basliklar={["Kişi", "Adet", "%"]}
                    satirlar={veri.aramalar.arayan.map((d) => [d.ad, d.sayi, `%${d.yuzde}`])}
                  />
                </div>
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="max-w-[320px]">
                  <Doughnut data={halka(veri.rakipler.dagilim)} options={halkaAyar} />
                </div>
                <Tablo
                  basliklar={["Rakip", "Müşteri", "%"]}
                  satirlar={veri.rakipler.dagilim.map((d) => [d.ad, d.sayi, `%${d.yuzde}`])}
                />
              </div>
            )}
          </Bolum>

          {/* Market seçiliyse üstteki "Rakip dağılımı" zaten o marketin
              dağılımı; aynı tabloyu ikinci kez basmanın anlamı yok.
              Seçim yokken en büyük marketler tek tek kırılıyor. */}
          {!veri.market && veri.market_rakip.map((mr) => (
            <Bolum
              key={mr.market}
              baslik={`${mr.market} — rakip dağılımı`}
              not={`${mr.musteri_sayisi} müşteri, ${mr.rakibi_bilinen} tanesinde rakip bilgisi var.`}
            >
              {mr.dagilim.length === 0 ? (
                <p className="text-xs text-muted-foreground">Bu markette rakip bilgisi yok.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="max-w-[360px]">
                    <Bar
                      data={{
                        labels: mr.dagilim.map((d) => d.ad),
                        datasets: [{
                          label: "Müşteri",
                          data: mr.dagilim.map((d) => d.sayi),
                          backgroundColor: RENKLER[1],
                        }],
                      }}
                      options={{
                        animation: false,
                        plugins: { legend: { display: false } },
                        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                      }}
                    />
                  </div>
                  <Tablo
                    basliklar={["Rakip", "Müşteri", "%"]}
                    satirlar={mr.dagilim.map((d) => [d.ad, d.sayi, `%${d.yuzde}`])}
                  />
                </div>
              )}
            </Bolum>
          ))}
        </div>
      )}
    </div>
  );
}
