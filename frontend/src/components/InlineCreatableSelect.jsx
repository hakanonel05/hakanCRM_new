import { useState, useEffect, useRef, memo } from "react";
import { Check, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "./ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/* KATEGORİ HAPLARI TEK RENK.
 *
 * Burada on iki renklik bir palet vardı ve renk, DEĞERİN HASH'İNDEN
 * seçiliyordu: "Otomotiv" yeşile, "Kimya" kırmızıya düşüyordu. Bu bir bilgi
 * taşımıyor — üstelik zararlı, çünkü bu palette yeşil "başarı", kırmızı
 * "hata" demek. Market ya da şehir adına rastgele bu anlamlar yükleniyordu.
 *
 * Renk, bir şey İFADE ETTİĞİNDE ortaya çıkar. Kategori bir durum değil, o
 * yüzden sessiz bir gri hap: okunur, sıralanır, göz yormaz. Gerçek durum
 * alanları (Durum, Potansiyel) kendi anlamlı renklerini kullanmaya devam
 * ediyor.
 */
const PILL_CLASS = "bg-muted text-foreground";

const getColorForValue = (value) => (value ? PILL_CLASS : "bg-muted text-muted-foreground");

const InlineCreatableSelect = ({ 
  value, 
  onChange, 
  options = [],
  fieldName,
  onOptionAdded
}) => {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [localOptions, setLocalOptions] = useState([]);
  const inputRef = useRef(null);

  // Update localOptions whenever options prop changes
  useEffect(() => {
    const formatted = options.map(opt => {
      if (typeof opt === "string") {
        return { value: opt, id: opt };
      }
      return { ...opt, id: opt.id || opt.value };
    });
    setLocalOptions(formatted);
  }, [options]);

  const filteredOptions = localOptions.filter(opt =>
    opt.value.toLowerCase().includes(searchValue.toLowerCase())
  );

  const showCreateOption = searchValue &&
    !localOptions.some(opt => opt.value.toLowerCase() === searchValue.toLowerCase());

  const handleSelect = (selectedValue) => {
    onChange(selectedValue);
    setOpen(false);
    setSearchValue("");
  };

  const handleCreate = async () => {
    const newValue = searchValue.trim();
    if (!newValue) return;
    
    try {
      const response = await axios.post(`${API}/options`, {
        field_name: fieldName,
        value: newValue,
        color: null
      });

      const newOption = {
        value: response.data.value,
        id: response.data.id
      };
      
      // Add to local options immediately
      setLocalOptions(prev => [...prev, newOption]);
      
      // Set the value
      onChange(newValue);
      setSearchValue("");
      setOpen(false);

      // Notify parent to refresh options
      if (onOptionAdded) {
        // Small delay to ensure backend has saved
        setTimeout(() => onOptionAdded(newOption), 100);
      }
    } catch (error) {
      console.error("Seçenek eklenirken hata:", error);
    }
  };

  const colorClass = getColorForValue(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "text-left px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer inline-flex items-center whitespace-nowrap",
            "hover:opacity-80 transition-opacity",
            value ? colorClass : "text-muted-foreground"
          )}
        >
          {value || "-"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <div className="p-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Ara veya yeni ekle..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-8 h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && showCreateOption) {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
          </div>
        </div>
        
        <div className="max-h-[200px] overflow-y-auto">
          {/* Empty option */}
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center text-muted-foreground"
            onClick={() => handleSelect("")}
          >
            (Boş)
          </button>
          
          {/* Existing options */}
          {filteredOptions.map((opt) => (
            <button
              key={opt.id}
              className={cn(
                "w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2",
                value === opt.value && "bg-muted"
              )}
              onClick={() => handleSelect(opt.value)}
            >
              {value === opt.value && <Check className="w-4 h-4 text-status-success-fg" />}
              <span className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium",
                getColorForValue(opt.value),
                value !== opt.value && "ml-6"
              )}>
                {opt.value}
              </span>
            </button>
          ))}

          {/* Create new option */}
          {showCreateOption && (
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-status-success-bg flex items-center gap-2 text-status-success-fg border-t"
              onClick={handleCreate}
            >
              <Plus className="w-4 h-4" />
              &quot;{searchValue}&quot; ekle
            </button>
          )}

          {/* No results */}
          {filteredOptions.length === 0 && !showCreateOption && (
            <div className="px-3 py-2 text-sm text-muted-foreground text-center">
              Sonuç bulunamadı
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default memo(InlineCreatableSelect, (prev, next) =>
  prev.value === next.value &&
  prev.fieldName === next.fieldName &&
  prev.onChange === next.onChange &&
  prev.onOptionAdded === next.onOptionAdded &&
  // Re-render only when options identity changes — parent should memoize
  prev.options === next.options
);
