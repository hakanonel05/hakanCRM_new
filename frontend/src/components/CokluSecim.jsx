import { useState, useMemo, useEffect } from "react";
import axios from "axios";
import { Check, Plus, Search, X } from "lucide-react";
import { Input } from "./ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { normalize } from "../utils/searchHelpers";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/* Çok değerli seçim: rakip ve partner alanları için.
 *
 * Bir müşteri hem ABB hem Siemens kullanabiliyor, birden fazla partnerle
 * çalışabiliyor. Tek değerli CreatableSelect ikincisini yazmaya izin
 * vermiyordu.
 *
 * Arama normalize() ile: "çelik" ile "ÇELİK" aynı sayılıyor. Düz
 * toLowerCase() Türkçe'de yetmiyor ("I"nın küçüğü "ı").
 *
 * Seçenek listesi Ürünler alanındaki gibi ortak "options" tablosundan
 * geliyor; listede olmayan bir marka yazılırsa oraya ekleniyor.
 */
/* Şema durumu bir kez soruluyor ve modül düzeyinde paylaşılıyor: tabloda
 * yüzlerce hücre var, her biri ayrı istek atmamalı. */
let _durumSozu = null;
const cogulDurumu = () => {
  if (!_durumSozu) {
    _durumSozu = axios
      .get(`${API}/system/cogul-durum`)
      .then((r) => r.data)
      .catch(() => ({ coklu_hazir: true, mesaj: "" })); // sorulamadıysa engelleme
  }
  return _durumSozu;
};

export default function CokluSecim({
  values = [],
  onChange,
  options = [],
  fieldName,
  placeholder = "Seçin veya yazın",
  onOptionAdded,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [arama, setArama] = useState("");
  const [uyari, setUyari] = useState("");

  // Sütunlar yoksa ikinci değer sessizce kayboluyor; kullanıcı sebebini
  // görmeli, yoksa "ekleyemiyorum" diye tahmin etmek zorunda kalıyor.
  useEffect(() => {
    let iptal = false;
    cogulDurumu().then((d) => {
      if (!iptal && d && d.coklu_hazir === false) setUyari(d.mesaj || "");
    });
    return () => { iptal = true; };
  }, []);

  const secili = Array.isArray(values) ? values.filter(Boolean) : [];

  const secenekler = useMemo(
    () => options.map((o) => (typeof o === "string" ? o : o.value)).filter(Boolean),
    [options]
  );

  const suzulmus = useMemo(() => {
    const q = normalize(arama);
    return q ? secenekler.filter((o) => normalize(o).includes(q)) : secenekler;
  }, [secenekler, arama]);

  // Tam olarak yazılan değer listede yoksa "ekle" satırı çıksın
  const yeniEklenebilir =
    arama.trim() &&
    !secenekler.some((o) => normalize(o) === normalize(arama)) &&
    !secili.some((v) => normalize(v) === normalize(arama));

  const degistir = (deger) => {
    const varMi = secili.some((v) => normalize(v) === normalize(deger));
    onChange(varMi
      ? secili.filter((v) => normalize(v) !== normalize(deger))
      : [...secili, deger]);
  };

  const kaldir = (deger) =>
    onChange(secili.filter((v) => normalize(v) !== normalize(deger)));

  const yeniEkle = async () => {
    const deger = arama.trim();
    if (!deger) return;
    try {
      const { data } = await axios.post(`${API}/options`, {
        field_name: fieldName, value: deger, color: null,
      });
      onChange([...secili, data.value || deger]);
      setArama("");
      onOptionAdded?.({ value: data.value || deger, id: data.id });
    } catch (e) {
      // Seçenek tablosuna yazılamasa bile değeri müşteriye eklemek
      // kullanıcı için doğru davranış; liste sonradan düzelir.
      console.error("Seçenek eklenemedi:", e);
      onChange([...secili, deger]);
      setArama("");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {secili.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground"
        >
          {v}
          {!disabled && (
            <button
              type="button"
              onClick={() => kaldir(v)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`${v} kaldır`}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}

      {uyari && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-status-warning-bg px-2 py-0.5 text-[10px] font-medium text-status-warning-fg"
          title={uyari}
          data-testid="coklu-secim-uyari"
        >
          ⚠ tek değer
        </span>
      )}

      {!disabled && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary"
              data-testid={`coklu-secim-${fieldName}`}
            >
              <Plus className="h-3 w-3" />
              {secili.length ? "Ekle" : placeholder}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[230px] p-0" align="start">
            <div className="p-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={arama}
                  onChange={(e) => setArama(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && yeniEklenebilir) {
                      e.preventDefault();
                      yeniEkle();
                    }
                  }}
                  placeholder="Ara veya yeni yaz…"
                  className="h-8 pl-8 text-sm"
                />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto pb-2">
              {suzulmus.map((o) => {
                const isaretli = secili.some((v) => normalize(v) === normalize(o));
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => degistir(o)}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <span className="truncate">{o}</span>
                    {isaretli && <Check className="h-4 w-4 flex-shrink-0 text-primary" />}
                  </button>
                );
              })}
              {yeniEklenebilir && (
                <button
                  type="button"
                  onClick={yeniEkle}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-primary hover:bg-muted"
                >
                  <Plus className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">"{arama.trim()}" ekle</span>
                </button>
              )}
              {!suzulmus.length && !yeniEklenebilir && (
                <p className="px-3 py-2 text-sm text-muted-foreground">Sonuç yok</p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
