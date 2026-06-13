import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { MoreVertical, MapPin, Building2, Bell, Phone } from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";

const STATUS_COLORS = {
  Beklemede: "bg-amber-100 text-amber-700 border-amber-200",
  İletişimde: "bg-blue-100 text-blue-700 border-blue-200",
  "Teklif Verildi": "bg-violet-100 text-violet-700 border-violet-200",
  Çalışılıyor: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Kazanıldı: "bg-green-100 text-green-700 border-green-200",
  Kaybedildi: "bg-red-100 text-red-700 border-red-200",
};

/**
 * Mobile-first customer list. Renders one card per customer with all
 * critical info accessible by tap. Designed to replace the desktop table
 * on small viewports (<768px).
 *
 * Props:
 *   customers, selectedIds, toggleSelect, onOpen, onEdit, onDelete,
 *   onAddVisit, onAddCall, onDuplicate, onMerge, isAdmin
 */
export default function MobileCustomerList({
  customers,
  selectedIds = [],
  toggleSelect,
  onOpen,
  onEdit,
  onDelete,
  onAddVisit,
  onAddCall,
  onDuplicate,
  onMerge,
  isAdmin,
}) {
  if (!customers || customers.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/70 p-8">
        <Building2 className="w-10 h-10 mb-3 opacity-40" />
        <p className="text-sm font-medium text-muted-foreground">Müşteri bulunamadı</p>
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto bg-muted/30/30 p-2 space-y-2"
      data-testid="mobile-customer-list"
    >
      {customers.map((c) => {
        const isSelected = selectedIds.includes(c.id);
        const status = c.status || "Beklemede";
        const colorClass =
          STATUS_COLORS[status] || "bg-muted text-foreground border-border";
        return (
          <div
            key={c.id}
            className={`bg-card rounded-xl border ${
              isSelected ? "border-emerald-400" : "border-border"
            } px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] active:bg-muted/30 transition-colors`}
            data-testid={`mobile-cust-card-${c.id}`}
          >
            <div className="flex items-start gap-2.5">
              {isAdmin && toggleSelect && (
                <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(c.id)}
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => onOpen?.(c.id)}
                className="flex-1 min-w-0 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center font-semibold text-foreground text-sm flex-shrink-0">
                    {c.company_name?.charAt(0)?.toUpperCase() || "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-foreground text-[14px] truncate leading-tight">
                        {c.company_name || "—"}
                      </p>
                      {c.is_followup && (
                        <Bell className="w-3 h-3 text-amber-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {[c.market, c.application].filter(Boolean).join(" · ") ||
                        "—"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-medium px-1.5 py-0 h-5 border ${colorClass}`}
                  >
                    {status}
                  </Badge>
                  {c.city && (
                    <span className="inline-flex items-center text-[11px] text-muted-foreground gap-0.5">
                      <MapPin className="w-3 h-3" />
                      {c.city}
                      {c.district ? `, ${c.district}` : ""}
                    </span>
                  )}
                  {c.last_call_outcome && (
                    <span className="inline-flex items-center text-[11px] text-muted-foreground gap-0.5">
                      <Phone className="w-3 h-3" />
                      {c.last_call_outcome}
                    </span>
                  )}
                </div>

                {(c.partner || c.assigned_to) && (
                  <p className="text-[11px] text-muted-foreground/70 mt-1.5 truncate">
                    {[c.partner && `🤝 ${c.partner}`, c.assigned_to && `👤 ${c.assigned_to}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0 -mr-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={4} className="w-44">
                  <DropdownMenuItem onClick={() => onOpen?.(c.id)}>
                    Detayı Aç
                  </DropdownMenuItem>
                  {onAddVisit && (
                    <DropdownMenuItem onClick={() => onAddVisit(c.id)}>
                      Ziyaret Ekle
                    </DropdownMenuItem>
                  )}
                  {onAddCall && (
                    <DropdownMenuItem onClick={() => onAddCall(c.id)}>
                      Arama Ekle
                    </DropdownMenuItem>
                  )}
                  {onDuplicate && (
                    <DropdownMenuItem onClick={() => onDuplicate(c.id)}>
                      Kopyala
                    </DropdownMenuItem>
                  )}
                  {onMerge && (
                    <DropdownMenuItem onClick={() => onMerge(c.id)}>
                      Birleştir
                    </DropdownMenuItem>
                  )}
                  {(onEdit || onDelete) && <DropdownMenuSeparator />}
                  {onEdit && (
                    <DropdownMenuItem onClick={() => onEdit(c.id)}>
                      Düzenle
                    </DropdownMenuItem>
                  )}
                  {onDelete && isAdmin && (
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600"
                      onClick={() => onDelete(c.id)}
                    >
                      Sil
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}
    </div>
  );
}
