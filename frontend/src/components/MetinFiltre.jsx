import { useEffect, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { ChevronDown, X } from "lucide-react";

/* METİN SÜZGECİ — yazarak süz, listeden seçme
 * ============================================================================
 * Önce iki biçimli bir süzgeçti: "Listeden seç" ve "İçerir". Kullanıcı
 * listeyi hiç istemediğini söyledi — her alanda kendi yazmak istiyor. Liste
 * biçimi kaldırıldı.
 *
 * Neden liste yerine yazmak daha iyi çalışıyor: 3.122 kayıtta "Uygulama"
 * alanının yüzlerce farklı değeri var ("Shrink Makinası", "Pişirme
 * Fırınları", "Paketleme Makinesi"...). Aradığı şeyi listede bulmak için
 * kaydırmak hem yavaş hem de eksik: "paketleme" geçen on ayrı değeri tek
 * tek işaretlemesi gerekirdi. Yazınca hepsi birden geliyor.
 *
 * TEK TERİM. Birden çok değeri VEYA ile birleştirmek için Gelişmiş Filtre
 * paneli var; burada her alana bir kalıp yazılıyor ve alanlar birbiriyle VE
 * ile birleşiyor.
 *
 * `secili` yalnızca BAĞLANTIDAN gelen tam eşleşmeleri gösterir (haritadaki
 * "Müşterilerde Aç" ?city=İstanbul ile geliyor). Buradan yeni bir tane
 * eklenemez, sadece görünür ve temizlenebilir — yoksa o bağlantılar
 * sessizce çalışmaz hâle gelirdi.
 */
export default function MetinFiltre({
  etiket,
  secili = [],
  onSeciliDegisti,
  icerir = "",
  onIcerirDegisti,
  genislik = "w-[140px]",
  ipucu,
}) {
  const [acik, setAcik] = useState(false);
  const [taslak, setTaslak] = useState(icerir);
  const girdiRef = useRef(null);

  /* Dışarıdan değişirse (temizle düğmesi, bağlantı) kutu da güncellensin. */
  useEffect(() => {
    setTaslak(icerir);
  }, [icerir]);

  useEffect(() => {
    if (acik) setTimeout(() => girdiRef.current?.focus(), 30);
  }, [acik]);

  const aktif = Boolean(icerir) || secili.length > 0;
  const ozet = icerir
    ? icerir
    : secili.length === 0
      ? etiket
      : secili.length === 1
        ? secili[0]
        : `${etiket} (${secili.length})`;

  const uygula = () => {
    const v = taslak.trim();
    onIcerirDegisti(v);
    /* Yazılan kalıp, bağlantıdan gelen tam eşleşmenin yerini alıyor —
       ikisi birden uygulanırsa sonuç beklenmedik şekilde daralır. */
    if (v && secili.length) onSeciliDegisti([]);
    setAcik(false);
  };

  const temizle = () => {
    setTaslak("");
    onIcerirDegisti("");
    onSeciliDegisti([]);
    setAcik(false);
  };

  return (
    <Popover open={acik} onOpenChange={setAcik}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`${genislik} h-8 px-3 text-xs rounded-full border flex items-center justify-between gap-1 transition-colors ${
            aktif
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-card text-foreground hover:bg-muted"
          }`}
          title={aktif ? `${etiket}: ${ozet}` : etiket}
        >
          <span className="truncate">{ozet}</span>
          <ChevronDown className="w-3 h-3 flex-shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[250px] p-3 space-y-2" align="start">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {ipucu || (
            <>
              Yazdığınız metni <strong className="text-foreground">içeren</strong> tüm
              kayıtlar listelenir.
            </>
          )}
        </p>

        <Input
          ref={girdiRef}
          value={taslak}
          onChange={(e) => setTaslak(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") uygula();
            if (e.key === "Escape") setAcik(false);
          }}
          placeholder={`${etiket} içinde ara…`}
          className="h-8 text-xs"
        />

        <div className="flex items-center gap-2">
          <Button size="sm" className="flex-1 h-8 text-xs" onClick={uygula}>
            Uygula
          </Button>
          {aktif && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-muted-foreground"
              onClick={temizle}
              title="Bu süzgeci temizle"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>

        {secili.length > 0 && (
          <p className="text-[11px] text-muted-foreground border-t border-border pt-2">
            Bağlantıdan gelen seçim:{" "}
            <span className="text-foreground">{secili.join(", ")}</span>
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
