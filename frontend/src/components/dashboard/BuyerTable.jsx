import { ChevronLeft, ChevronRight } from "lucide-react";

const POT_STYLES = {
  HIGH: "bg-teal-50 text-teal-800 border-teal-200",
  MEDIUM: "bg-amber-50 text-amber-800 border-amber-200",
  LOW: "bg-zinc-100 text-zinc-700 border-zinc-200",
  UNKNOWN: "bg-zinc-50 text-zinc-500 border-zinc-200",
};

const OUTREACH_STYLES = {
  NONE: "bg-zinc-50 text-zinc-500 border-zinc-200",
  DRAFTED: "bg-indigo-50 text-indigo-700 border-indigo-200",
  SENT: "bg-blue-50 text-blue-700 border-blue-200",
  REPLIED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  QUOTED: "bg-teal-50 text-teal-800 border-teal-200",
};

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch { return "—"; }
}

function Badge({ text, cls }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] ${cls}`}>
      {text}
    </span>
  );
}

export default function BuyerTable({ items, total, page, pageSize, loading, onPageChange, onRowClick }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.02)]" data-testid="buyer-table">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#fafafa] border-b border-zinc-200">
              {["Organization", "Country", "Business Type", "Purchase Potential", "Account Manager", "Outreach", "Last Enriched"].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-16 text-center text-zinc-400 text-sm">Loading…</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-16 text-center" data-testid="buyer-table-empty">
                <div className="text-zinc-500 font-medium">No buyers match your filters.</div>
                <div className="mt-1 text-xs text-zinc-400">Try clearing filters or importing a new batch.</div>
              </td></tr>
            )}
            {items.map((b) => (
              <tr
                key={b.id}
                data-testid={`buyer-row-${b.id}`}
                onClick={() => onRowClick(b)}
                className="border-b border-zinc-100 last:border-0 hover:bg-teal-50/30 cursor-pointer transition-colors"
              >
                <td className="px-5 py-4">
                  <div className="font-semibold text-zinc-900">{b.organization}</div>
                  {b.website && <div className="text-xs text-zinc-500 truncate max-w-[280px]">{b.website}</div>}
                </td>
                <td className="px-5 py-4 text-zinc-700">{b.country || "—"}</td>
                <td className="px-5 py-4 text-zinc-700">{b.business_type || "—"}</td>
                <td className="px-5 py-4">
                  <Badge text={b.purchase_potential || "UNKNOWN"} cls={POT_STYLES[b.purchase_potential] || POT_STYLES.UNKNOWN} />
                </td>
                <td className="px-5 py-4 text-zinc-700">
                  {b.account_manager || <span className="text-zinc-400 italic">Unassigned</span>}
                </td>
                <td className="px-5 py-4">
                  <Badge text={b.outreach_status || "NONE"} cls={OUTREACH_STYLES[b.outreach_status] || OUTREACH_STYLES.NONE} />
                </td>
                <td className="px-5 py-4 text-zinc-600 text-xs">{fmtDate(b.enrichment_updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-200 bg-[#fafafa]">
        <div className="text-xs text-zinc-500" data-testid="pagination-info">
          {total === 0 ? "0 buyers" : `${start}–${end} of ${total}`}
        </div>
        <div className="flex items-center gap-2">
          <button
            data-testid="pagination-prev"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <span className="text-xs text-zinc-500">Page <b>{page}</b> / {totalPages}</span>
          <button
            data-testid="pagination-next"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
