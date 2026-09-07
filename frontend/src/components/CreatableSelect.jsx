import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Plus, Pencil, Trash2, X, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "../App";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/* ETİKET RENKLERİ TEK RENGE İNDİ.
 *
 * Backend her seçeneğe bir renk adı ("emerald", "purple", "cyan"…) veriyor ve
 * burada on beş ayrı hap rengine çevriliyordu. Kategoriyi renklendirmek bir
 * bilgi taşımıyor: "Otomotiv"in yeşil, "Kimya"nın kırmızı olması okuyucuya
 * hiçbir şey söylemez — bu palette yeşil ve kırmızının işi belli
 * (başarı / hata), rastgele kategorilere dağıtılınca o anlam bozulur.
 *
 * Backend'in renk alanı OLDUĞU GİBİ duruyor; yalnızca burada göz ardı
 * ediliyor. Yani veri kaybı yok, isterse geri açılır.
 */
const TAG_PILL = { bg: "bg-muted", text: "text-foreground", border: "border-border" };

const getColorClasses = () => TAG_PILL;

const CreatableSelect = ({ 
  value, 
  onChange, 
  fieldName, 
  placeholder = "Seçin veya yazın...",
  options = [],
  onOptionAdded
}) => {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [localOptions, setLocalOptions] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    const formatted = options.map(opt => {
      if (typeof opt === "string") {
        return { value: opt, color: null, id: opt };
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

  const selectedOption = localOptions.find(opt => opt.value === value);
  const selectedColor = selectedOption?.color ? getColorClasses(selectedOption.color) : null;

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
        color: response.data.color,
        id: response.data.id 
      };
      
      // Add to local options immediately
      setLocalOptions(prev => [...prev, newOption]);
      onChange(newValue);
      setSearchValue("");
      setOpen(false);
      
      if (onOptionAdded) {
        // Small delay to ensure backend has saved
        setTimeout(() => onOptionAdded(newOption), 100);
      }
    } catch (error) {
      console.error("Seçenek eklenirken hata:", error);
    }
  };

  const handleEdit = async (opt) => {
    if (!editValue.trim()) return;
    
    try {
      await axios.put(`${API}/options/${opt.id}`, {
        value: editValue,
        color: opt.color
      });
      
      // Update local state
      setLocalOptions(localOptions.map(o => 
        o.id === opt.id ? { ...o, value: editValue } : o
      ));
      
      // Update selected value if it was the edited option
      if (value === opt.value) {
        onChange(editValue);
      }
      
      setEditingId(null);
      setEditValue("");
      toast.success("Seçenek güncellendi");
      
      if (onOptionAdded) {
        onOptionAdded({ ...opt, value: editValue });
      }
    } catch (error) {
      console.error("Seçenek güncellenirken hata:", error);
      toast.error("Güncelleme başarısız");
    }
  };

  const handleDelete = async (opt) => {
    if (!window.confirm(`"${opt.value}" seçeneğini silmek istediğinizden emin misiniz?`)) return;
    
    try {
      await axios.delete(`${API}/options/${opt.id}`);
      
      setLocalOptions(localOptions.filter(o => o.id !== opt.id));
      
      if (value === opt.value) {
        onChange("");
      }
      
      toast.success("Seçenek silindi");
      
      if (onOptionAdded) {
        onOptionAdded(null);
      }
    } catch (error) {
      toast.error("Silme başarısız");
    }
  };

  const startEdit = (opt, e) => {
    e.stopPropagation();
    setEditingId(opt.id);
    setEditValue(opt.value);
  };

  const cancelEdit = (e) => {
    e.stopPropagation();
    setEditingId(null);
    setEditValue("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            selectedColor && `${selectedColor.bg} ${selectedColor.text} ${selectedColor.border}`
          )}
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput 
            placeholder="Ara veya yeni ekle..." 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>
              {showCreateOption ? (
                <button
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-status-success-fg hover:bg-status-success-bg rounded"
                  onClick={handleCreate}
                >
                  <Plus className="w-4 h-4" />
                  &ldquo;{searchValue}&rdquo; ekle
                </button>
              ) : (
                "Sonuç bulunamadı"
              )}
            </CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((opt) => {
                const colorClasses = opt.color ? getColorClasses(opt.color) : null;
                const isEditing = editingId === opt.id;
                
                return (
                  <CommandItem
                    key={opt.id}
                    value={opt.value}
                    onSelect={() => {
                      if (!isEditing) {
                        onChange(opt.value === value ? "" : opt.value);
                        setOpen(false);
                      }
                    }}
                    className="flex items-center justify-between group"
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1" onClick={e => e.stopPropagation()}>
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="h-7 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleEdit(opt);
                            }
                            if (e.key === "Escape") {
                              cancelEdit(e);
                            }
                          }}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-status-success-fg"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(opt);
                          }}
                        >
                          <Save className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-muted-foreground"
                          onClick={cancelEdit}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <Check
                            className={cn(
                              "h-4 w-4",
                              value === opt.value ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className={cn(
                            "px-2 py-0.5 rounded text-sm",
                            colorClasses && `${colorClasses.bg} ${colorClasses.text}`
                          )}>
                            {opt.value}
                          </span>
                        </div>
                        
                        {/* Edit/Delete buttons - visible on hover */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-muted-foreground hover:text-status-info-fg"
                            onClick={(e) => startEdit(opt, e)}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          {isAdmin && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-muted-foreground hover:text-status-danger-fg"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(opt);
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {showCreateOption && filteredOptions.length > 0 && (
              <CommandGroup>
                <CommandItem onSelect={handleCreate}>
                  <Plus className="mr-2 h-4 w-4 text-status-success-fg" />
                  <span className="text-status-success-fg">&ldquo;{searchValue}&rdquo; ekle</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default CreatableSelect;
