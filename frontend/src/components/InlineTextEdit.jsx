import React, { useState, useEffect, useRef, memo } from "react";
import { Input } from "./ui/input";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * InlineTextEdit — Notion/Airtable-style click-to-edit cell.
 *
 * Props:
 *   value         current value
 *   customerId    id of the customer to update
 *   field         field name to patch (e.g. "company_name", "website")
 *   onSaved       optional callback (newValue) after successful save
 *   displayClass  className for the display span
 *   placeholder   placeholder when empty
 *   renderDisplay optional custom display renderer (val) => ReactNode
 *   editTrigger   "double" (default) or "single" click to enter edit mode
 *   onSingleClick optional handler fired on single click (when editTrigger="double").
 *                 Used for "click to open detail, dblclick to edit" pattern.
 */
const InlineTextEdit = ({
  value,
  customerId,
  field,
  onSaved,
  displayClass = "text-sm font-medium truncate flex-1",
  placeholder = "—",
  renderDisplay,
  editTrigger = "double",
  inputClass = "h-7 text-sm",
  onSingleClick,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  const clickTimer = useRef(null);

  useEffect(() => { setDraft(value ?? ""); }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = (e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(value ?? "");
  };

  const save = async () => {
    const newVal = (draft ?? "").trim();
    if (newVal === (value ?? "").trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await axios.put(`${API}/customers/${customerId}`, { [field]: newVal });
      toast.success("Güncellendi", { duration: 1500 });
      setEditing(false);
      onSaved?.(newVal);
    } catch (err) {
      const msg = err?.response?.data?.detail || "Güncelleme başarısız";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const onKey = (e) => {
    if (e.key === "Enter") { e.preventDefault(); save(); }
    else if (e.key === "Escape") { e.preventDefault(); cancel(); }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
        <Input
          ref={inputRef}
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={save}
          className={inputClass}
        />
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); save(); }}
          className="text-emerald-600 hover:text-emerald-700 disabled:opacity-40"
          disabled={saving}
          title="Kaydet (Enter)"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); cancel(); }}
          className="text-slate-400 hover:text-slate-600"
          title="İptal (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const triggerProps = editTrigger === "double"
    ? {
        onDoubleClick: (e) => {
          if (clickTimer.current) {
            clearTimeout(clickTimer.current);
            clickTimer.current = null;
          }
          startEdit(e);
        },
        onClick: onSingleClick
          ? (e) => {
              if (clickTimer.current) clearTimeout(clickTimer.current);
              clickTimer.current = setTimeout(() => {
                clickTimer.current = null;
                onSingleClick(e);
              }, 220);
            }
          : undefined,
      }
    : { onClick: startEdit };

  return (
    <span
      {...triggerProps}
      className={`${displayClass} ${onSingleClick ? "cursor-pointer" : "cursor-text"}`}
      title={onSingleClick ? "Tıkla: detay  ·  Çift tıkla: düzenle" : "Düzenlemek için çift tıklayın"}
    >
      {renderDisplay
        ? renderDisplay(value)
        : (value || <span className="text-slate-300">{placeholder}</span>)}
    </span>
  );
};

export default memo(InlineTextEdit, (prev, next) =>
  prev.value === next.value &&
  prev.customerId === next.customerId &&
  prev.field === next.field &&
  prev.placeholder === next.placeholder &&
  prev.displayClass === next.displayClass &&
  prev.renderDisplay === next.renderDisplay &&
  prev.onSingleClick === next.onSingleClick &&
  prev.onSaved === next.onSaved
);
