import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api";
import { Search, X } from "lucide-react";

export default function BuyerSearch({ value, onChange, onSelect }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!value || value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await apiClient.get("/buyers/suggest", { params: { q: value } });
        setSuggestions(data || []);
      } catch {
        setSuggestions([]);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pick = (b) => {
    setOpen(false);
    onSelect?.(b);
  };

  const onKey = (e) => {
    if (!open || !suggestions.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && activeIdx >= 0) { e.preventDefault(); pick(suggestions[activeIdx]); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative" data-testid="buyer-search">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <input
          data-testid="buyer-search-input"
          type="text"
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); setActiveIdx(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder="Search buyers by organization, email, or website…"
          className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-10 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition"
        />
        {value && (
          <button
            data-testid="buyer-search-clear"
            onClick={() => { onChange(""); setSuggestions([]); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 grid place-items-center rounded-md hover:bg-zinc-100 text-zinc-500"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div
          data-testid="buyer-search-suggestions"
          className="absolute z-30 mt-2 w-full rounded-xl border border-zinc-200 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.08)] overflow-hidden"
        >
          {suggestions.map((s, i) => (
            <button
              key={s.id}
              data-testid={`suggest-${s.id}`}
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => pick(s)}
              className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition ${i === activeIdx ? "bg-teal-50" : "hover:bg-zinc-50"}`}
            >
              <div className="min-w-0">
                <div className="font-medium text-zinc-900 truncate">{s.organization}</div>
                <div className="text-xs text-zinc-500 truncate">{s.website || s.email}</div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">{s.country || ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
