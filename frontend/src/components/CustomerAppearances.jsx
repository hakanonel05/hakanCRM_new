import { useNavigate } from "react-router-dom";
import { Columns3, SlidersHorizontal, Workflow } from "lucide-react";

/* Bir müşterinin sistemin geri kalanında nerelerde göründüğünü gösteren
 * rozetler. Müşteriler sayfasında arama yapınca eşleşen satırların altında
 * çıkıyor.
 *
 * Üç kaynak, üç ayrı mantık:
 *   Süreç panosu — gerçek kayıt (process_cards). Sunucudan toplu geliyor.
 *   Kanban       — hesaplanıyor: görünümün group_by alanındaki değer, o
 *                  müşterinin düştüğü sütun.
 *   Filtre       — hesaplanıyor: kayıtlı filtrenin koşulları uyuyor mu.
 *
 * Yalnızca arama yapılırken gösteriliyor. Sayfada 50 satır var; her satırda
 * sürekli rozet olsa tablo okunmaz hâle gelirdi.
 */

const Rozet = ({ icon: Icon, renk, baslik, children, onClick, testid }) => (
  <button
    type="button"
    onClick={(e) => {
      // Satırın tamamı müşteri kartını açıyor; rozet kendi hedefine gitmeli.
      e.stopPropagation();
      onClick();
    }}
    title={baslik}
    data-testid={testid}
    className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors ${renk}`}
  >
    <Icon className="h-2.5 w-2.5 flex-shrink-0" />
    <span className="truncate max-w-[180px]">{children}</span>
  </button>
);

export default function CustomerAppearances({ customer, processCards, kanbanViews, savedFilters, matchesFilter }) {
  const navigate = useNavigate();

  const surecler = processCards || [];

  // Kanban: group_by alanı dolu olan görünümler. Boşsa müşteri o panoda
  // sütunsuz kalıyor — "Kanban: —" göstermek bilgi değil gürültü.
  const kanbanlar = (kanbanViews || [])
    .map((v) => {
      const deger = (customer?.[v.group_by] || "").toString().trim();
      return deger ? { view: v, sutun: deger } : null;
    })
    .filter(Boolean);

  const filtreler = (savedFilters || []).filter((f) =>
    matchesFilter(customer, f.conditions, f.logic)
  );

  if (!surecler.length && !kanbanlar.length && !filtreler.length) {
    return (
      <span className="text-[10px] text-muted-foreground">
        Hiçbir süreç panosunda, kanbanda veya kayıtlı filtrede yok
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {surecler.map((s) => (
        <Rozet
          key={`s-${s.board_id}-${s.stage_id}`}
          icon={Workflow}
          renk="bg-status-success-bg text-status-success-fg border-status-success-line hover:opacity-80"
          baslik={`Süreç panosu: ${s.board_name} → ${s.stage_name}`}
          testid={`appear-process-${s.board_id}`}
          onClick={() => navigate(`/kanban?mode=process&board=${s.board_id}`)}
        >
          {s.board_name} → {s.stage_name}
        </Rozet>
      ))}

      {kanbanlar.map(({ view, sutun }) => (
        <Rozet
          key={`k-${view.id}`}
          icon={Columns3}
          renk="bg-muted text-foreground border-border hover:bg-muted/70"
          baslik={`Kanban "${view.name}" görünümünde "${sutun}" sütununda`}
          testid={`appear-kanban-${view.id}`}
          onClick={() => navigate(`/kanban?view=${view.id}`)}
        >
          {view.name}: {sutun}
        </Rozet>
      ))}

      {filtreler.map((f) => (
        <Rozet
          key={`f-${f.id}`}
          icon={SlidersHorizontal}
          renk="bg-status-warning-bg text-status-warning-fg border-status-warning-line hover:opacity-80"
          baslik={`"${f.name}" kayıtlı filtresine giriyor`}
          testid={`appear-filter-${f.id}`}
          onClick={() => navigate(`/filters?apply=${f.id}`)}
        >
          {f.name}
        </Rozet>
      ))}
    </div>
  );
}
