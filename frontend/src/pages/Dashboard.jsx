import { useEffect, useMemo, useState, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import StatsBand from "@/components/dashboard/StatsBand";
import BuyerSearch from "@/components/dashboard/BuyerSearch";
import BuyerFilters from "@/components/dashboard/BuyerFilters";
import BuyerTable from "@/components/dashboard/BuyerTable";
import BuyerDossier from "@/components/dashboard/BuyerDossier";
import ImportBuyersDialog from "@/components/dashboard/ImportBuyersDialog";
import { Upload } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const EMPTY_FILTERS = {
  purchase_potential: "",
  country: "",
  business_type: "",
  account_manager: "",
  sources_from_india: "",
  unassigned: false,
  segment: "",
};

export default function Dashboard() {
  const { user } = useAuth();
  const isEditor = user?.role === "editor";

  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedBuyerId, setSelectedBuyerId] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const pageSize = 50;

  const query = useMemo(() => {
    const p = { page, page_size: pageSize };
    if (search) p.q = search;
    if (filters.purchase_potential) p.purchase_potential = filters.purchase_potential;
    if (filters.country) p.country = filters.country;
    if (filters.business_type) p.business_type = filters.business_type;
    if (filters.account_manager) p.account_manager = filters.account_manager;
    if (filters.sources_from_india) p.sources_from_india = filters.sources_from_india;
    if (filters.unassigned) p.unassigned = true;
    if (filters.segment) p.segment = filters.segment;
    return p;
  }, [search, filters, page]);

  const loadBuyers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get("/buyers", { params: query });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const loadStats = useCallback(async () => {
    const { data } = await apiClient.get("/buyers/stats");
    setStats(data);
  }, []);

  useEffect(() => { loadBuyers(); }, [loadBuyers, refreshKey]);
  useEffect(() => { loadStats(); }, [loadStats, refreshKey]);
  useEffect(() => { setPage(1); }, [search, filters]);

  const handleBuyerChanged = () => setRefreshKey((k) => k + 1);

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-teal-700">Buyer Directory</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl font-black tracking-tight text-zinc-900">Dashboard</h1>
          <p className="mt-2 text-zinc-600 max-w-2xl">
            Every global wholesale buyer in Qalara&apos;s pipeline — searchable, filterable, and ready for outreach.
          </p>
        </div>
        <TooltipProvider delayDuration={100}>
          {isEditor ? (
            <button
              data-testid="import-buyers-btn"
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 transition-colors text-white font-medium px-4 py-2.5"
            >
              <Upload className="h-4 w-4" />
              Import Buyers
            </button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <button
                    disabled
                    data-testid="import-buyers-btn-disabled"
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-600 text-white font-medium px-4 py-2.5 opacity-50 cursor-not-allowed"
                  >
                    <Upload className="h-4 w-4" />
                    Import Buyers
                  </button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">Demo mode — read only</TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      </div>

      <StatsBand stats={stats} />

      <div className="space-y-4">
        <BuyerSearch value={search} onChange={setSearch} onSelect={(b) => setSelectedBuyerId(b.id)} />
        <BuyerFilters filters={filters} onChange={setFilters} />
      </div>

      <BuyerTable
        items={items}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        onPageChange={setPage}
        onRowClick={(b) => setSelectedBuyerId(b.id)}
      />

      <BuyerDossier
        buyerId={selectedBuyerId}
        onClose={() => setSelectedBuyerId(null)}
        onBuyerChanged={handleBuyerChanged}
      />

      <ImportBuyersDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={handleBuyerChanged}
      />
    </div>
  );
}
