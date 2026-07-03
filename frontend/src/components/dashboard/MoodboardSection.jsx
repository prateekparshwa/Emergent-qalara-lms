import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { Palette, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function daysAgo(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export default function MoodboardSection({ buyer, isEditor, onBuyerChanged }) {
  const [running, setRunning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [brokenImgs, setBrokenImgs] = useState(new Set());
  const timerRef = useRef(null);
  const STEPS = ["Scraping images", "Fetching site", "Analyzing brand"];
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);
  useEffect(() => { setBrokenImgs(new Set()); }, [buyer?.id]);

  const run = async (force = false) => {
    setRunning(true); setStepIdx(0);
    timerRef.current = setInterval(() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)), 2500);
    try {
      const { data } = await apiClient.post(
        `/buyers/${buyer.id}/moodboard`, null,
        { params: force ? { force: true } : {} },
      );
      if (data?.needs_confirm) { setConfirmOpen(true); return; }
      onBuyerChanged?.(data);
      const err = data?.moodboard?.error;
      toast[err ? "warning" : "success"](err ? "Partial moodboard saved" : "Moodboard generated");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Moodboard failed");
    } finally {
      clearInterval(timerRef.current); timerRef.current = null;
      setRunning(false); setStepIdx(0);
    }
  };

  const mb = buyer?.moodboard;
  const has = mb && mb.generated_at;
  const d = daysAgo(mb?.generated_at);
  const validImages = (mb?.images || []).filter((u) => !brokenImgs.has(u));
  const limitedImagery = has && validImages.length < 3;

  return (
    <section data-testid="dossier-moodboard">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400">Brand Moodboard</h3>
        <div className="flex items-center gap-2">
          {mb?.generated_at && (
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500" data-testid="moodboard-freshness">
              Generated {d === 0 ? "today" : `${d}d ago`}
            </span>
          )}
          {isEditor && (
            <button
              data-testid="moodboard-btn"
              disabled={running}
              onClick={() => run(false)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-60 text-white text-xs font-medium px-3 py-1.5 transition-colors"
            >
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
                has ? <RefreshCw className="h-3.5 w-3.5" /> : <Palette className="h-3.5 w-3.5" />}
              {running ? "Generating…" : has ? "Regenerate" : "Generate Moodboard"}
            </button>
          )}
        </div>
      </div>

      {running && (
        <div data-testid="moodboard-progress" className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <ol className="space-y-2">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-3 text-sm">
                <span className={`h-5 w-5 rounded-full grid place-items-center border ${
                  i < stepIdx ? "bg-zinc-900 border-zinc-900 text-white" :
                  i === stepIdx ? "border-zinc-900 text-zinc-900" :
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

      {!running && !has && (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-[#fafafa] p-6 text-sm text-zinc-500 flex items-center gap-3">
          <Palette className="h-4 w-4 text-teal-600" />
          {isEditor ? 'Click "Generate Moodboard" to visualize this brand.' : "Moodboard is editor-only."}
        </div>
      )}

      {!running && has && (
        <div className="space-y-5" data-testid="moodboard-content">
          {mb.tagline && (
            <p className="font-display text-2xl md:text-3xl font-black tracking-tight text-zinc-900 leading-[1.15]" data-testid="moodboard-tagline">
              &ldquo;{mb.tagline}&rdquo;
            </p>
          )}

          {!!mb.color_palette?.length && (
            <div data-testid="moodboard-palette">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-2">Palette</div>
              <div className="flex rounded-xl overflow-hidden border border-zinc-200 h-16 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
                {mb.color_palette.slice(0, 5).map((hex, i) => (
                  <div key={i} className="flex-1 relative group" style={{ backgroundColor: hex }} data-testid={`moodboard-swatch-${i}`}>
                    <div className="absolute inset-x-0 bottom-0 bg-black/40 text-white text-[10px] font-mono uppercase text-center py-0.5 opacity-0 group-hover:opacity-100 transition">
                      {hex}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-1.5 grid grid-cols-5 gap-1 text-[10px] font-mono text-zinc-500 text-center">
                {mb.color_palette.slice(0, 5).map((h, i) => <div key={i}>{h}</div>)}
              </div>
            </div>
          )}

          {limitedImagery ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-[#fafafa] p-4 text-xs text-zinc-500 flex items-center gap-2" data-testid="moodboard-limited-imagery">
              <AlertTriangle className="h-3.5 w-3.5" />
              Limited imagery on site — showing palette and brand identity only.
            </div>
          ) : (
            <div data-testid="moodboard-images" className="columns-2 sm:columns-3 gap-2 [column-fill:_balance]">
              {validImages.map((src, i) => (
                <img
                  key={src + i}
                  src={src}
                  alt=""
                  onError={() => setBrokenImgs((prev) => new Set(prev).add(src))}
                  className="mb-2 w-full rounded-lg border border-zinc-200 break-inside-avoid object-cover"
                  loading="lazy"
                />
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {!!mb.brand_voice?.length && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-2">Brand Voice</div>
                <div className="flex flex-wrap gap-1.5">
                  {mb.brand_voice.map((v, i) => (
                    <span key={i} className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-full px-2.5 py-1 font-medium">{v}</span>
                  ))}
                </div>
              </div>
            )}
            {mb.typography_feel && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-2">Typography</div>
                <div className="text-sm text-zinc-800 italic">{mb.typography_feel}</div>
              </div>
            )}
          </div>

          {!!mb.aesthetic_keywords?.length && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-2">Aesthetic</div>
              <div className="flex flex-wrap gap-1.5">
                {mb.aesthetic_keywords.map((k, i) => (
                  <span key={i} className="text-xs bg-white border border-zinc-300 text-zinc-700 rounded-full px-2.5 py-1 font-medium">{k}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent data-testid="moodboard-reconfirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate moodboard?</AlertDialogTitle>
            <AlertDialogDescription>
              Generated {d} day{d === 1 ? "" : "s"} ago. Regenerating overwrites the existing moodboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="moodboard-recancel">Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="moodboard-reconfirm-btn"
              onClick={() => { setConfirmOpen(false); run(true); }}
              className="bg-zinc-900 hover:bg-zinc-800">
              Yes, regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
