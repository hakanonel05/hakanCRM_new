import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Loader2, History, ArrowRight, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/* Bir müşterinin değişiklik geçmişi: gün gün, saat saat, kim neyi neyden
 * neye çevirmiş.
 *
 * Alan etiketleri burada çevriliyor, geçmişte ham alan adı saklanıyor.
 * Böylece bir alanın adı yarın değişirse eski kayıtlar da yeni adla
 * görünüyor — geçmişi yeniden yazmak gerekmiyor. */
const ALAN_ADLARI = {
  company_name: "Firma Adı",
  market: "Market",
  application: "Uygulama",
  city: "Şehir",
  district: "İlçe",
  website: "Web Sitesi",
  status: "Durum",
  potential_level: "Potansiyel Seviye",
  potential_value: "Potansiyel (k€)",
  assigned_to: "Takip Eden",
  competitor: "Rakip",
  partner: "Partner",
  is_followup: "Takipte",
  next_followup_date: "Sonraki Takip",
  description: "Açıklama",
  notes: "Notlar",
  notes_list: "Not Geçmişi",
  contact_info: "İletişim",
  contacts: "Kişiler",
  products: "Ürünler",
  tags: "Etiketler",
  documents: "Belgeler",
};

/* Alan değişikliği taşımayan kayıt tipleri (ziyaret, arama, dosya...).
 * Bunlarda başlık zaten olayı anlatıyor. */
const TIP_ETIKET = {
  customer_created: "Oluşturuldu",
  customer_updated: "Güncellendi",
  status_changed: "Durum",
  followup_changed: "Takip",
  visit_created: "Ziyaret",
  call_created: "Arama",
  contact_added: "Kişi eklendi",
  contact_deleted: "Kişi silindi",
  file_uploaded: "Dosya",
  email_sent: "E-posta",
  bulk_import: "Toplu içe aktarma",
  field_values_merged: "Birleştirme",
};

const iki = (n) => String(n).padStart(2, "0");

const tarihParcala = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return { gun: "Bilinmiyor", saat: "", sira: 0 };
  return {
    gun: `${iki(d.getDate())}.${iki(d.getMonth() + 1)}.${d.getFullYear()}`,
    saat: `${iki(d.getHours())}:${iki(d.getMinutes())}`,
    sira: d.getTime(),
  };
};

const gunBasligi = (gun) => {
  const bugun = new Date();
  const dun = new Date(bugun);
  dun.setDate(bugun.getDate() - 1);
  const bicim = (d) => `${iki(d.getDate())}.${iki(d.getMonth() + 1)}.${d.getFullYear()}`;
  if (gun === bicim(bugun)) return `Bugün · ${gun}`;
  if (gun === bicim(dun)) return `Dün · ${gun}`;
  return gun;
};

const Deger = ({ children, bos }) => (
  <span
    className={
      bos
        ? "italic text-muted-foreground"
        : "rounded bg-muted px-1 py-0.5 text-foreground"
    }
  >
    {bos ? "boş" : children}
  </span>
);

export default function CustomerHistoryModal({ open, onClose, customerId, customerName }) {
  const [kayitlar, setKayitlar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState("");

  const getir = useCallback(async () => {
    if (!customerId) return;
    setYukleniyor(true);
    setHata("");
    try {
      const { data } = await axios.get(`${API}/customers/${customerId}/history`);
      setKayitlar(data?.history || []);
    } catch (e) {
      setHata(
        e?.response?.data?.detail || "Geçmiş yüklenemedi. Tekrar deneyin."
      );
    } finally {
      setYukleniyor(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (open) getir();
  }, [open, getir]);

  // Güne göre grupla; kayıtlar sunucudan zaten yeniden eskiye sıralı geliyor.
  const gunler = [];
  for (const k of kayitlar) {
    const { gun, saat } = tarihParcala(k.created_at);
    let grup = gunler.find((g) => g.gun === gun);
    if (!grup) {
      grup = { gun, kayitlar: [] };
      gunler.push(grup);
    }
    grup.kayitlar.push({ ...k, saat });
  }

  return (
    <Dialog open={open} onOpenChange={(a) => !a && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-muted-foreground" />
            Değişiklik Geçmişi
          </DialogTitle>
          <DialogDescription className="truncate">
            {customerName || "Müşteri"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1" data-testid="history-body">
          {yukleniyor && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Geçmiş yükleniyor...
            </div>
          )}

          {!yukleniyor && hata && (
            <p className="py-10 text-center text-sm text-status-danger-fg">{hata}</p>
          )}

          {!yukleniyor && !hata && kayitlar.length === 0 && (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-foreground">Henüz kayıt yok</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Bu müşteride yapılan değişiklikler buraya gelecek.
              </p>
            </div>
          )}

          {!yukleniyor &&
            gunler.map((g) => (
              <div key={g.gun} className="mb-4">
                <div className="sticky top-0 z-10 bg-card/95 py-1 backdrop-blur">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {gunBasligi(g.gun)}
                  </span>
                </div>

                <div className="border-l border-border pl-3">
                  {g.kayitlar.map((k) => (
                    <div key={k.id} className="relative py-2" data-testid={`history-item-${k.id}`}>
                      <span className="absolute -left-[17px] top-3.5 h-1.5 w-1.5 rounded-full bg-border" />

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-mono text-xs tabular-nums text-foreground">
                          {k.saat}
                        </span>
                        <span className="rounded border border-border px-1 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {TIP_ETIKET[k.type] || k.type}
                        </span>
                        <span
                          className="flex items-center gap-1 text-xs text-muted-foreground"
                          title={
                            k.user_name
                              ? k.user_email || k.user_name
                              : "Bu kayıt, kimin yaptığı tutulmaya başlanmadan önce oluşmuş. Eski kayıtlar için bu bilgi veri tabanında hiç yok."
                          }
                        >
                          <User className="h-3 w-3" />
                          {k.user_name || (
                            <span className="italic">kaydedilmemiş</span>
                          )}
                        </span>
                      </div>

                      {k.changes.length > 0 ? (
                        <ul className="mt-1 space-y-0.5">
                          {k.changes.map((d, i) => (
                            <li key={`${k.id}-${d.field}-${i}`} className="text-xs">
                              <span className="text-muted-foreground">
                                {ALAN_ADLARI[d.field] || d.field}:
                              </span>{" "}
                              <Deger bos={d.old === "" || d.old === null}>{String(d.old)}</Deger>
                              <ArrowRight className="mx-1 inline h-3 w-3 text-muted-foreground" />
                              <Deger bos={d.new === "" || d.new === null}>{String(d.new)}</Deger>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {k.subtitle || k.title}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
