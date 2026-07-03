import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { Mail, Loader2, RefreshCw, Copy, Send, CheckCircle2, MessageSquare, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const STEPS = ["Reading enrichment", "Loading Qalara profile", "Writing email"];

const STATUS_STYLES = {
  NONE: "bg-zinc-50 text-zinc-500 border-zinc-200",
  DRAFTED: "bg-sky-50 text-sky-800 border-sky-200",
  SENT: "bg-teal-50 text-teal-800 border-teal-200",
  REPLIED: "bg-violet-50 text-violet-800 border-violet-200",
  QUOTED: "bg-amber-50 text-amber-800 border-amber-200",
};

function daysAgo(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function freshnessLabel(iso, prefix) {
  const d = daysAgo(iso);
  if (d === null) return null;
  return `${prefix} ${d === 0 ? "today" : `${d}d ago`}`;
}

export default function OutreachSection({ buyer, isEditor, onBuyerChanged }) {
  const [running, setRunning] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const timerRef = useRef(null);

  const emails = buyer?.outreach_emails || [];
  const latest = emails.length ? emails[emails.length - 1] : null;
  const status = buyer?.outreach_status || "NONE";
  const enrichment = buyer?.enrichment;
  const hasEnrichment = !!(
    enrichment &&
    !enrichment.error &&
    (enrichment.summary || enrichment.products_sold?.length || enrichment.fit_categories?.length || enrichment.brand_style)
  );

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // Sync editable fields with latest draft whenever buyer changes
  useEffect(() => {
    setSubject(latest?.subject || "");
    setBody(latest?.body || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyer?.id, latest?.drafted_at]);

  const draft = async () => {
    setRunning(true);
    setStepIdx(0);
    timerRef.current = setInterval(
      () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)),
      2200,
    );
    try {
      const { data } = await apiClient.post(`/buyers/${buyer.id}/outreach/draft`);
      onBuyerChanged?.(data);
      toast.success("Outreach draft generated");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Draft failed");
    } finally {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setRunning(false);
      setStepIdx(0);
    }
  };

  const copy = async () => {
    const combined = `Subject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(combined);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  };

  const markSent = async () => {
    try {
      const { data } = await apiClient.post(`/buyers/${buyer.id}/outreach/send`);
      onBuyerChanged?.(data);
      toast.success("Marked as sent");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not mark as sent");
    }
  };

  const setStatus = async (newStatus) => {
    try {
      const { data } = await apiClient.post(`/buyers/${buyer.id}/outreach/status`, { status: newStatus });
      onBuyerChanged?.(data);
      toast.success(`Marked as ${newStatus.toLowerCase()}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not update status");
    }
  };

  const draftBtnDisabled = running || !isEditor || !hasEnrichment;
  const drafted = !!latest;
  const statusCls = STATUS_STYLES[status] || STATUS_STYLES.NONE;

  return (
    <section data-testid="dossier-outreach">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400">Outreach</h3>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] ${statusCls}`}
            data-testid="outreach-status-pill"
          >
            {status}
          </span>
          {latest?.sent_at && (
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500" data-testid="outreach-sent-freshness">
              {freshnessLabel(latest.sent_at, "Sent")}
            </span>
          )}
          {!latest?.sent_at && latest?.drafted_at && (
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500" data-testid="outreach-drafted-freshness">
              {freshnessLabel(latest.drafted_at, "Drafted")}
            </span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {isEditor && (
          <TooltipProvider delayDuration={100}>
            {drafted ? (
              <button
                data-testid="outreach-regenerate-btn"
                disabled={running || !hasEnrichment}
                onClick={draft}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-xs font-medium px-3 py-1.5 transition-colors"
              >
                {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {running ? "Regenerating…" : "Regenerate"}
              </button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    data-testid="outreach-draft-btn"
                    disabled={draftBtnDisabled}
                    onClick={draft}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-1.5 transition-colors"
                  >
                    {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                    {running ? "Drafting…" : "Draft Outreach Email"}
                  </button>
                </TooltipTrigger>
                {!hasEnrichment && (
                  <TooltipContent side="bottom">Enrich this buyer first</TooltipContent>
                )}
              </Tooltip>
            )}
          </TooltipProvider>
        )}

        {drafted && (
          <>
            <button
              data-testid="outreach-copy-btn"
              onClick={copy}
              disabled={!subject && !body}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-medium px-3 py-1.5 transition-colors disabled:opacity-50"
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
            {isEditor && status !== "SENT" && status !== "REPLIED" && status !== "QUOTED" && (
              <button
                data-testid="outreach-mark-sent-btn"
                onClick={markSent}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium px-3 py-1.5 transition-colors"
              >
                <Send className="h-3.5 w-3.5" /> Mark as Sent
              </button>
            )}
          </>
        )}

        {isEditor && (status === "SENT" || status === "REPLIED" || status === "QUOTED" || status === "DRAFTED") && (
          <div className="ml-auto flex items-center gap-1.5" data-testid="outreach-manual-status">
            {status !== "REPLIED" && (
              <button
                data-testid="outreach-mark-replied-btn"
                onClick={() => setStatus("REPLIED")}
                className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-800 text-[10px] font-bold uppercase tracking-[0.16em] px-2.5 py-1 transition-colors"
              >
                <MessageSquare className="h-3 w-3" /> Mark Replied
              </button>
            )}
            {status !== "QUOTED" && (
              <button
                data-testid="outreach-mark-quoted-btn"
                onClick={() => setStatus("QUOTED")}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-[0.16em] px-2.5 py-1 transition-colors"
              >
                <FileText className="h-3 w-3" /> Mark Quoted
              </button>
            )}
          </div>
        )}
      </div>

      {/* Progress */}
      {running && (
        <div data-testid="outreach-progress" className="rounded-xl border border-teal-200 bg-teal-50/60 p-4">
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

      {/* Empty state */}
      {!running && !drafted && (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-[#fafafa] p-6 text-sm text-zinc-500 flex items-center gap-3">
          <Mail className="h-4 w-4 text-teal-600" />
          {isEditor
            ? (hasEnrichment
                ? 'Click "Draft Outreach Email" to generate a personalised email.'
                : "Enrich this buyer first to unlock AI outreach drafting.")
            : "Outreach drafting is editor-only."}
        </div>
      )}

      {/* Editable draft */}
      {!running && drafted && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3" data-testid="outreach-draft-panel">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-1.5 block">Subject</label>
            <Input
              data-testid="outreach-subject-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={!isEditor}
              className="text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-1.5 block">Body</label>
            <Textarea
              data-testid="outreach-body-input"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={!isEditor}
              rows={10}
              className="text-sm leading-relaxed resize-y font-normal"
            />
          </div>
          {status === "SENT" && (
            <div className="flex items-center gap-1.5 text-xs text-teal-700" data-testid="outreach-sent-indicator">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Sent {latest?.sent_at ? new Date(latest.sent_at).toLocaleString() : ""}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
