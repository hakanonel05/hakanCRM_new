import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Check, ChevronDown, X } from "lucide-react";

/* ÇOKLU SEÇİMLİ SÜZGEÇ — iki çalışma biçimi
 * ============================================================================
 * "Listeden seç": birden çok değer işaretlenebiliyor. Önceki sürümde tek
 * seçim vardı ve seçilen değer sunucuya tam eşleşme olarak gidiyordu.
 *
 * "İçerir": listede olmayan bir kalıbı elle yazmak için. Kullanıcının örneği:
 * "Paketleme" yazınca uygulamasında paketleme geçen her müşteri gelsin —
 * "Paketleme Makinesi", "Gıda Paketleme" hepsi. Listeden seçmekle bunu
 * yapmak mümkün değil, çünkü her varyantı tek tek işaretlemek gerekiyor.
 *
 * İki biçim BİRLİKTE çalışmıyor; hangisi doluysa o uygulanıyor. Aynı anda
 * ikisini birden vermek "şu üç şehirden biri VE adında x geçen" gibi bir
 * anlam üretir ki bu ekranda kimse onu beklemiyor — ve sessizce yanlış
 * sonuç vermektense birini seçtirmek daha dürüst.
 */
export default function CokluFiltre({
  etiket,
  secenekler = [],
  secili = [],          // string[]
  onSeciliDegisti,
  icerir = "",          // serbest metin
  onIcerirDegisti,
  genislik = "w-[140px]",
}) {
  const [acik, setAcik] = useState(false);
  const [ara, setAra] = useState("");
  const [mod, setMod] = useState(icerir ? "icerir" : "liste");
  const [icerirTaslak, setIcerirTaslak] = useState(icerir);

  const suzulen = useMemo(() => {
    const q = ara.trim().toLocaleLowerCase("tr");
    const liste = secenekler.filter(Boolean);
    if (!q) return liste.slice(0, 200);
    return liste
      .filter((x) => String(x).toLocaleLowerCase("tr").includes(q))
      .slice(0, 200);
  }, [secenekler, ara]);

  const aktif = icerir ? 1 : secili.length;
  const ozet = icerir
    ? `içerir: ${icerir}`
    : secili.length === 0
      ? etiket
      : secili.length === 1
        ? secili[0]
        : `${etiket} (${secili.length})`;

  const degistir = (deger) => {
    const yeni = secili.includes(deger)
      ? secili.filter((x) => x !== deger)
      : [...secili, deger];
    onSeciliDegisti(yeni);
  };

  const temizle = () => {
    onSeciliDegisti([]);
    onIcerirDegisti("");
    setIcerirTaslak("");
    setAra("");
  };

  const icerirUygula = () => {
    const v = icerirTaslak.trim();
    onIcerirDegisti(v);
    if (v) onSeciliDegisti([]);
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
        >
          <span className="truncate">{ozet}</span>
          <ChevronDown className="w-3 h-3 flex-shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[260px] p-0" align="start">
        {/* Biçim seçici */}
        <div className="flex items-center gap-1 p-2 border-b border-border">
          {[
            ["liste", "Listeden seç"],
            ["icerir", "İçerir"],
          ].map(([deger, yazi]) => (
            <button
              key={deger}
              type="button"
              onClick={() => setMod(deger)}
              className={`flex-1 h-7 text-[11px] rounded-md transition-colors ${
                mod === deger
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted/60"
              }`}
            >
              {yazi}
            </button>
          ))}
        </div>

        {mod === "liste" ? (
          <>
            <div className="p-2 border-b border-border">
              <Input
                value={ara}
                onChange={(e) => setAra(e.target.value)}
                placeholder={`${etiket} ara…`}
                className="h-8 text-xs"
              />
            </div>
            <div className="max-h-[260px] overflow-y-auto py-1">
              {suzulen.length === 0 && (
                <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                  Eşleşen değer yok.
                </p>
              )}
              {suzulen.map((deger) => {
                const isaretli = secili.includes(deger);
                return (
                  <button
                    key={deger}
                    type="button"
                    onClick={() => degistir(deger)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-muted"
                  >
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                        isaretli ? "bg-foreground border-foreground" : "border-border"
                      }`}
                    >
                      {isaretli && <Check className="w-3 h-3 text-background" />}
                    </span>
                    <span className="truncate">{deger}</span>
                  </button>
                );
              })}
              {secenekler.length > suzulen.length && (
                <p className="px-3 py-2 text-[11px] text-muted-foreground">
                  {secenekler.length - suzulen.length} değer daha var — aramayı daraltın.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="p-3 space-y-2">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Yazdığınız metni <strong className="text-foreground">içeren</strong> tüm
              kayıtlar listelenir. Örnek: <em>Paketleme</em> → "Gıda Paketleme",
              "Paketleme Makinesi"…
            </p>
            <Input
              value={icerirTaslak}
              onChange={(e) => setIcerirTaslak(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") icerirUygula();
              }}
              placeholder={`${etiket} içinde ara…`}
              className="h-8 text-xs"
              autoFocus
            />
            <Button size="sm" className="w-full h-8 text-xs" onClick={icerirUygula}>
              Uygula
            </Button>
          </div>
        )}

        {aktif > 0 && (
          <div className="border-t border-border p-2">
            <button
              type="button"
              onClick={temizle}
              className="w-full h-7 text-[11px] rounded-md text-muted-foreground hover:bg-muted flex items-center justify-center gap-1"
            >
              <X className="w-3 h-3" />
              Bu süzgeci temizle
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
