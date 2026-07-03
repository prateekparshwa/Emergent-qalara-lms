import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { Sparkles, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STEPS = ["Scraping site", "Searching web", "Analyzing"];

const POT_STYLES = {
  HIGH: "bg-teal-50 text-teal-800 border-teal-200",
  MEDIUM: "bg-amber-50 text-amber-800 border-amber-200",
  LOW: "bg-zinc-100 text-zinc-700 border-zinc-200",
  UNKNOWN: "bg-zinc-50 text-zinc-500 border-zinc-200",
};

function daysAgo(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export default function EnrichmentSection({ buyer, isEditor, onBuyerChanged }) {
  const [running, setRunning] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const run = async (force = false) => {
    setRunning(true);
    setStepIdx(0);
    timerRef.current = setInterval(
      () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)),
      2500,
    );
    try {
      const { data } = await apiClient.post(
        `/buyers/${buyer.id}/enrich`,
        null,
        { params: force ? { force: true } : {} },
      );
      if (data?.needs_confirm) {
        setConfirmOpen(true);
        return;
      }
      onBuyerChanged?.(data);
      if (data?._debug?.llm_ok === false) {
        toast.warning("Partial enrichment saved — AI analysis unavailable.");
      } else {
        toast.success("Buyer enriched");
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Enrichment failed");
    } finally {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setRunning(false);
      setStepIdx(0);
    }
  };

  const enrichment = buyer?.enrichment;
  const hasEnrichment = enrichment && !enrichment.error && Object.keys(enrichment).length > 0;
  const hasError = enrichment && enrichment.error;
  const d = daysAgo(buyer?.enrichment_updated_at);
  const potCls = POT_STYLES[enrichment?.purchase_potential] || POT_STYLES.UNKNOWN;

  return (
    <section data-testid="dossier-enrichment">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400">Enrichment</h3>
        <div className="flex items-center gap-2">
          {buyer?.enrichment_updated_at && (
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500" data-testid="enrichment-freshness">
              Enriched {d === 0 ? "today" : `${d} day${d === 1 ? "" : "s"} ago`}
            </span>
          )}
          {isEditor && (
            <button
              data-testid="enrich-btn"
              disabled={running}
              onClick={() => run(false)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-xs font-medium px-3 py-1.5 transition-colors"
            >
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
                hasEnrichment ? <RefreshCw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
              {running ? "Enriching…" : hasEnrichment ? "Re-enrich" : "Enrich with AI"}
            </button>
          )}
        </div>
      </div>

      {running && (
        <div data-testid="enrich-progress" className="rounded-xl border border-teal-200 bg-teal-50/60 p-4">
          <ol className="space-y-2">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-3 text-sm">
                <span className={`h-5 w-5 rounded-full grid place-items-center border ${
                  i < stepIdx ? "bg-teal-600 border-teal-600 text-white" :
                  i === stepIdx ? "border-teal-600 text-teal-700" :
                  "border-zinc-300 text-zinc-400"
                }`}>
                  {i < stepIdx ? "✓" : i === stepIdx ? <Loader2 className="h-3 w-3 animate-spin" /> : i + 1}
                </span>
                <span className={i <= stepIdx ? "text-zinc-900 font-medium" : "text-zinc-400"}>{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {!running && !enrichment && (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-[#fafafa] p-6 text-sm text-zinc-500 flex items-center gap-3">
          <Sparkles className="h-4 w-4 text-teal-600" />
          Not enriched yet. {isEditor ? 'Click "Enrich with AI" to analyze this buyer.' : "Enrichment is editor-only."}
        </div>
      )}

      {!running && hasError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900 flex items-start gap-3" data-testid="enrichment-error">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <div>
            <div className="font-semibold">Partial enrichment</div>
            <div className="mt-1 text-amber-800/90">
              {enrichment.error}. Scraped {enrichment.site_text_len || 0} chars of site text, {enrichment.snippets_count || 0} snippets.
            </div>
          </div>
        </div>
      )}

      {!running && hasEnrichment && (
        <div className="space-y-5">
          {enrichment.summary && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-1.5">Summary</div>
              <p className="text-sm text-zinc-800 leading-relaxed">{enrichment.summary}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {!!enrichment.products_sold?.length && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-1.5">What they sell</div>
                <div className="flex flex-wrap gap-1.5">
                  {enrichment.products_sold.map((p, i) => (
                    <span key={i} className="text-xs bg-white border border-zinc-200 rounded-full px-2.5 py-0.5 text-zinc-700">{p}</span>
                  ))}
                </div>
              </div>
            )}
            {!!enrichment.markets_served?.length && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-1.5">Markets served</div>
                <div className="flex flex-wrap gap-1.5">
                  {enrichment.markets_served.map((m, i) => (
                    <span key={i} className="text-xs bg-white border border-zinc-200 rounded-full px-2.5 py-0.5 text-zinc-700">{m}</span>
                  ))}
                </div>
              </div>
            )}
            {enrichment.target_customers && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-1.5">Target customers</div>
                <p className="text-sm text-zinc-800">{enrichment.target_customers}</p>
              </div>
            )}
            {enrichment.estimated_size && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-1.5">Estimated size</div>
                <p className="text-sm text-zinc-800">{enrichment.estimated_size}</p>
              </div>
            )}
            {enrichment.brand_style && (
              <div className="sm:col-span-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-1.5">Brand style</div>
                <p className="text-sm text-zinc-800 italic">&ldquo;{enrichment.brand_style}&rdquo;</p>
              </div>
            )}
          </div>

          {enrichment.purchase_potential && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] ${potCls}`} data-testid="enrichment-potential">
                  {enrichment.purchase_potential}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Purchase Potential</span>
              </div>
              {enrichment.potential_rationale && (
                <p className="text-sm text-zinc-700 leading-relaxed">{enrichment.potential_rationale}</p>
              )}
            </div>
          )}

          {!!enrichment.fit_categories?.length && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-2">Qalara Fit</div>
              <div className="flex flex-wrap gap-2" data-testid="enrichment-fit-categories">
                {enrichment.fit_categories.map((c, i) => (
                  <span key={i} className="text-xs bg-teal-50 border border-teal-200 text-teal-800 rounded-full px-3 py-1 font-medium">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent data-testid="reenrich-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Re-enrich this buyer?</AlertDialogTitle>
            <AlertDialogDescription>
              This buyer was enriched {d} day{d === 1 ? "" : "s"} ago. Re-running will overwrite the existing enrichment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="reenrich-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="reenrich-confirm-btn"
              onClick={() => { setConfirmOpen(false); run(true); }}
              className="bg-teal-600 hover:bg-teal-700"
            >
              Yes, re-enrich
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
