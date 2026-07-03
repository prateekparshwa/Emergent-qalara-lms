import { Users, Flame, Gauge, Sparkles, UserCheck } from "lucide-react";

const CARDS = [
  { key: "total", label: "Total Buyers", Icon: Users, accent: "text-zinc-700 bg-zinc-100" },
  { key: "high", label: "HIGH Potential", Icon: Flame, accent: "text-teal-700 bg-teal-50" },
  { key: "medium", label: "MEDIUM Potential", Icon: Gauge, accent: "text-amber-700 bg-amber-50" },
  { key: "with_enrichment", label: "Enriched", Icon: Sparkles, accent: "text-indigo-700 bg-indigo-50" },
  { key: "assigned", label: "Assigned to AM", Icon: UserCheck, accent: "text-emerald-700 bg-emerald-50" },
];

export default function StatsBand({ stats }) {
  return (
    <div
      data-testid="stats-band"
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4"
    >
      {CARDS.map(({ key, label, Icon, accent }) => (
        <div
          key={key}
          data-testid={`stat-${key}`}
          className="rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(0,0,0,0.04)] transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{label}</p>
            <div className={`h-8 w-8 rounded-lg grid place-items-center ${accent}`}>
              <Icon className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 font-display text-3xl font-black tracking-tight text-zinc-900">
            {stats == null ? "—" : stats[key] ?? 0}
          </p>
        </div>
      ))}
    </div>
  );
}
