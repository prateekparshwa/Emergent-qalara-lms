import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Search, Loader2, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const STEPS = ["Finding website", "Scraping", "Searching", "Analyzing", "Building moodboard"];

export default function Discover() {
  const { user } = useAuth();
  const isEditor = user?.role === "editor";
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const navigate = useNavigate();

  const run = async () => {
    if (!input.trim()) return;
    setRunning(true); setStepIdx(0);
    const t = setInterval(() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)), 3000);
    try {
      const { data } = await apiClient.post("/discover", { input: input.trim() });
      toast.success(`Discovered ${data.organization}`);
      navigate(`/dashboard?open=${data.id}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Discovery failed");
    } finally { clearInterval(t); setRunning(false); }
  };

  return (
    <div className="max-w-3xl" data-testid="discover-page">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-teal-700">Prospect Research</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl font-black tracking-tight text-zinc-900">Discover</h1>
      <p className="mt-3 text-zinc-600 max-w-2xl">Research any new prospect from scratch — enter a company name, website URL, or email address.</p>

      <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Prospect</label>
        <div className="mt-2 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input data-testid="discover-input" value={input} onChange={(e) => setInput(e.target.value)}
              disabled={running || !isEditor}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="e.g. Anthropologie · westelm.com · buyer@nordichome.se"
              className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-3 py-3 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20" />
          </div>
          <TooltipProvider delayDuration={100}>
            {isEditor ? (
              <button data-testid="discover-btn" onClick={run} disabled={running || !input.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-medium px-5 py-3">
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {running ? "Researching…" : "Research"}
              </button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild><span>
                  <button disabled data-testid="discover-btn-disabled"
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-600 text-white font-medium px-5 py-3 opacity-50 cursor-not-allowed">
                    <Sparkles className="h-4 w-4" />Research
                  </button>
                </span></TooltipTrigger>
                <TooltipContent side="bottom">Demo mode — read only</TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        </div>

        {running && (
          <div className="mt-6 rounded-xl border border-teal-200 bg-teal-50/60 p-5" data-testid="discover-progress">
            <ol className="space-y-2.5">
              {STEPS.map((s, i) => (
                <li key={s} className="flex items-center gap-3 text-sm">
                  <span className={`h-5 w-5 rounded-full grid place-items-center border ${
                    i < stepIdx ? "bg-teal-600 border-teal-600 text-white" :
                    i === stepIdx ? "border-teal-600 text-teal-700" :
                    "border-zinc-300 text-zinc-400"}`}>
                    {i < stepIdx ? "✓" : i === stepIdx ? <Loader2 className="h-3 w-3 animate-spin" /> : i + 1}
                  </span>
                  <span className={i <= stepIdx ? "text-zinc-900 font-medium" : "text-zinc-400"}>{s}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
