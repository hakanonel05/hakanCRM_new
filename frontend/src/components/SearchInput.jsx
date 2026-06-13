import { useState, useEffect, useRef, memo } from "react";
import { Search } from "lucide-react";
import { Input } from "./ui/input";

/**
 * SearchInput — isolated controlled input that ONLY re-renders itself on each
 * keystroke. It owns local state and calls `onDebouncedChange` after `delay`ms
 * of inactivity. This prevents the parent (huge Customers table) from
 * re-rendering on every character typed, which was causing severe input lag.
 *
 * Props:
 *  - value: external value (used as initial + when external clears reset us)
 *  - onDebouncedChange: (value: string) => void
 *  - delay: ms to wait before calling onDebouncedChange (default 300)
 *  - placeholder, className, ...
 */
const SearchInput = memo(function SearchInput({
  value: externalValue = "",
  onDebouncedChange,
  delay = 300,
  placeholder = "Ara…",
  className = "",
  testid,
}) {
  const [local, setLocal] = useState(externalValue);
  const lastDebouncedRef = useRef(externalValue);
  const timerRef = useRef(null);
  // Keep a ref to the latest callback so we don't depend on it in the effect.
  const callbackRef = useRef(onDebouncedChange);
  useEffect(() => {
    callbackRef.current = onDebouncedChange;
  }, [onDebouncedChange]);

  // If parent clears externalValue (e.g. "Temizle" button), reset local too.
  useEffect(() => {
    if (externalValue !== lastDebouncedRef.current) {
      setLocal(externalValue);
      lastDebouncedRef.current = externalValue;
    }
  }, [externalValue]);

  useEffect(() => {
    if (local === lastDebouncedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      lastDebouncedRef.current = local;
      callbackRef.current?.(local);
    }, delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [local, delay]);

  return (
    <div className="relative w-full">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
      <Input
        type="search"
        placeholder={placeholder}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        className={`pl-10 h-10 text-sm bg-muted/40 border-transparent focus:bg-card focus:border-primary/20 focus:ring-2 focus:ring-primary/10 rounded-lg transition-all ${className}`}
        data-testid={testid}
      />
    </div>
  );
});

export default SearchInput;
