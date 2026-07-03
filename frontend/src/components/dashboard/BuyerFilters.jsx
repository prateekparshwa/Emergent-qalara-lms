import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const POTENTIALS = ["HIGH", "MEDIUM", "LOW", "UNKNOWN"];

function FilterPill({ label, active, children, testid }) {
  return (
    <div data-testid={testid} className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 min-h-[42px]">
      <span
        aria-hidden
        className={`h-2 w-2 rounded-full transition-all ${active ? "bg-teal-500 shadow-[0_0_0_3px_rgba(20,184,166,0.18)]" : "bg-zinc-200"}`}
      />
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{label}</span>
      {children}
    </div>
  );
}

export default function BuyerFilters({ filters, onChange }) {
  const [facets, setFacets] = useState({ countries: [], business_types: [] });
  const [ams, setAms] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: f }, { data: a }] = await Promise.all([
          apiClient.get("/buyers/filter-facets"),
          apiClient.get("/buyers/account-managers"),
        ]);
        setFacets(f);
        setAms(a || []);
      } catch { /* ignore */ }
    })();
  }, []);

  const set = (k, v) => onChange({ ...filters, [k]: v });
  const clear = () => onChange({
    purchase_potential: "", country: "", business_type: "",
    account_manager: "", sources_from_india: "", unassigned: false,
  });

  const anyActive = Object.values(filters).some((v) => v !== "" && v !== false);

  return (
    <div className="flex flex-wrap items-center gap-2.5" data-testid="buyer-filters">
      <div data-testid="filter-segment" className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1">
        {[["","All"],["directory","Directory"],["discover","Discovered"]].map(([v,l]) => (
          <button key={v||"all"} data-testid={`segment-chip-${v||"all"}`} onClick={() => set("segment", v)}
            className={`text-xs font-semibold uppercase tracking-wider px-3 py-1.5 rounded-lg transition ${filters.segment===v?"bg-teal-600 text-white":"text-zinc-600 hover:bg-zinc-100"}`}>{l}</button>
        ))}
      </div>
      <FilterPill label="Potential" active={!!filters.purchase_potential} testid="filter-potential">
        <Select value={filters.purchase_potential || "__any"} onValueChange={(v) => set("purchase_potential", v === "__any" ? "" : v)}>
          <SelectTrigger className="h-7 border-0 shadow-none px-2 text-sm min-w-[110px]" data-testid="filter-potential-trigger">
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__any">Any</SelectItem>
            {POTENTIALS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterPill>

      <FilterPill label="Country" active={!!filters.country} testid="filter-country">
        <Select value={filters.country || "__any"} onValueChange={(v) => set("country", v === "__any" ? "" : v)}>
          <SelectTrigger className="h-7 border-0 shadow-none px-2 text-sm min-w-[130px]" data-testid="filter-country-trigger">
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="__any">Any</SelectItem>
            {facets.countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterPill>

      <FilterPill label="Business Type" active={!!filters.business_type} testid="filter-business">
        <Select value={filters.business_type || "__any"} onValueChange={(v) => set("business_type", v === "__any" ? "" : v)}>
          <SelectTrigger className="h-7 border-0 shadow-none px-2 text-sm min-w-[130px]" data-testid="filter-business-trigger">
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__any">Any</SelectItem>
            {facets.business_types.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterPill>

      <FilterPill label="Account Mgr" active={!!filters.account_manager} testid="filter-am">
        <Select value={filters.account_manager || "__any"} onValueChange={(v) => set("account_manager", v === "__any" ? "" : v)}>
          <SelectTrigger className="h-7 border-0 shadow-none px-2 text-sm min-w-[130px]" data-testid="filter-am-trigger">
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__any">Any</SelectItem>
            {ams.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterPill>

      <FilterPill label="India Sourcing" active={!!filters.sources_from_india} testid="filter-india">
        <Select value={filters.sources_from_india || "__any"} onValueChange={(v) => set("sources_from_india", v === "__any" ? "" : v)}>
          <SelectTrigger className="h-7 border-0 shadow-none px-2 text-sm min-w-[80px]" data-testid="filter-india-trigger">
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__any">Any</SelectItem>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      </FilterPill>

      <FilterPill label="Unassigned" active={filters.unassigned} testid="filter-unassigned">
        <Switch
          data-testid="filter-unassigned-toggle"
          checked={filters.unassigned}
          onCheckedChange={(v) => set("unassigned", v)}
          className="data-[state=checked]:bg-teal-600"
        />
      </FilterPill>

      {anyActive && (
        <button
          data-testid="filter-clear"
          onClick={clear}
          className="ml-1 text-xs font-medium text-teal-700 hover:text-teal-800 underline underline-offset-2"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
