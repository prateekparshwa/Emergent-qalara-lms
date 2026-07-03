import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Globe, Mail, User, Briefcase, MapPin, Building2, Layers, Flame } from "lucide-react";
import EnrichmentSection from "@/components/dashboard/EnrichmentSection";
import MoodboardSection from "@/components/dashboard/MoodboardSection";

const POT_STYLES = {
  HIGH: "bg-teal-50 text-teal-800 border-teal-200",
  MEDIUM: "bg-amber-50 text-amber-800 border-amber-200",
  LOW: "bg-zinc-100 text-zinc-700 border-zinc-200",
  UNKNOWN: "bg-zinc-50 text-zinc-500 border-zinc-200",
};

const UNASSIGNED = "__unassigned";

function Field({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-zinc-100 grid place-items-center text-zinc-600">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">{label}</div>
        <div className="mt-0.5 text-sm text-zinc-900 break-words">{value || <span className="text-zinc-400">—</span>}</div>
      </div>
    </div>
  );
}

export default function BuyerDossier({ buyerId, onClose, onBuyerChanged }) {
  const { user } = useAuth();
  const isEditor = user?.role === "editor";
  const [buyer, setBuyer] = useState(null);
  const [ams, setAms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!buyerId) { setBuyer(null); return; }
    setLoading(true);
    (async () => {
      try {
        const [{ data: b }, { data: a }] = await Promise.all([
          apiClient.get(`/buyers/${buyerId}`),
          apiClient.get("/buyers/account-managers"),
        ]);
        setBuyer(b);
        setAms(a || []);
      } catch {
        toast.error("Could not load buyer");
        onClose();
      } finally { setLoading(false); }
    })();
  }, [buyerId, onClose]);

  const changeAM = async (val) => {
    const newAm = val === UNASSIGNED ? "" : val;
    try {
      const { data } = await apiClient.patch(`/buyers/${buyer.id}`, { account_manager: newAm });
      setBuyer(data);
      toast.success(newAm ? `Assigned to ${newAm}` : "Unassigned");
      onBuyerChanged?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Update failed");
    }
  };

  const addNote = async () => {
    const t = noteText.trim();
    if (!t) return;
    setSaving(true);
    try {
      const { data } = await apiClient.post(`/buyers/${buyer.id}/notes`, { text: t });
      setBuyer(data);
      setNoteText("");
      toast.success("Note added");
      onBuyerChanged?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not add note");
    } finally { setSaving(false); }
  };

  const open = !!buyerId;
  const notes = [...(buyer?.am_notes || [])].sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  const potCls = POT_STYLES[buyer?.purchase_potential] || POT_STYLES.UNKNOWN;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 overflow-y-auto" data-testid="buyer-dossier">
        {loading || !buyer ? (
          <div className="p-8 text-sm text-zinc-500">Loading…</div>
        ) : (
          <>
            <SheetHeader className="px-8 pt-8 pb-6 border-b border-zinc-200 bg-[#fafafa]">
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] ${potCls}`}>
                  {buyer.purchase_potential || "UNKNOWN"}
                </span>
                {buyer.sources_from_india && (
                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em]">
                    Sources from India
                  </span>
                )}
                <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white text-zinc-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em]">
                  {buyer.segment}
                </span>
              </div>
              <SheetTitle data-testid="dossier-title" className="font-display text-3xl font-black tracking-tight text-zinc-900">
                {buyer.organization}
              </SheetTitle>
              {buyer.potential_rationale && (
                <p className="mt-2 text-sm text-zinc-600 leading-relaxed">{buyer.potential_rationale}</p>
              )}
            </SheetHeader>

            <div className="px-8 py-6 space-y-6">
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400 mb-4">Contact</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Field icon={User} label="Contact" value={buyer.contact_name} />
                  <Field icon={Briefcase} label="Designation" value={buyer.designation} />
                  <Field icon={Mail} label="Email" value={buyer.email} />
                  <Field icon={Globe} label="Website" value={buyer.website} />
                </div>
              </section>

              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400 mb-4">Company</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Field icon={MapPin} label="Country" value={buyer.country} />
                  <Field icon={Building2} label="Business Type" value={buyer.business_type} />
                  <Field icon={Layers} label="Org Size" value={buyer.org_size} />
                  <Field icon={Flame} label="Potential" value={buyer.purchase_potential} />
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400">Account Manager</h3>
                </div>
                <TooltipProvider delayDuration={100}>
                  {isEditor ? (
                    <Select value={buyer.account_manager || UNASSIGNED} onValueChange={changeAM}>
                      <SelectTrigger data-testid="dossier-am-trigger" className="w-full">
                        <SelectValue placeholder="Assign account manager" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                        {ams.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                        {buyer.account_manager && !ams.includes(buyer.account_manager) && (
                          <SelectItem value={buyer.account_manager}>{buyer.account_manager}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div data-testid="dossier-am-readonly">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700 px-3 py-2 text-sm cursor-not-allowed">
                            {buyer.account_manager || "Unassigned"}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Demo mode — read only</TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </TooltipProvider>
              </section>

              <section data-testid="dossier-notes-section">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400 mb-3">
                  AM Notes {notes.length > 0 && <span className="text-zinc-500 ml-1">· {notes.length}</span>}
                </h3>

                <TooltipProvider delayDuration={100}>
                  {isEditor ? (
                    <div className="rounded-xl border border-zinc-200 bg-white p-3">
                      <Textarea
                        data-testid="dossier-note-textarea"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Add a note about this buyer…"
                        rows={3}
                        className="resize-none border-0 focus-visible:ring-0 p-0 shadow-none"
                      />
                      <div className="flex justify-end mt-2">
                        <button
                          data-testid="dossier-note-submit"
                          onClick={addNote}
                          disabled={!noteText.trim() || saving}
                          className="rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {saving ? "Saving…" : "Add note"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="rounded-xl border border-dashed border-zinc-300 bg-[#fafafa] p-4 text-sm text-zinc-500 text-center cursor-not-allowed">
                          Notes are read-only in demo mode.
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Demo mode — read only</TooltipContent>
                    </Tooltip>
                  )}
                </TooltipProvider>

                <ul className="mt-4 space-y-3">
                  {notes.length === 0 && (
                    <li className="text-sm text-zinc-400 italic">No notes yet.</li>
                  )}
                  {notes.map((n, i) => (
                    <li
                      key={i}
                      data-testid={`dossier-note-${i}`}
                      className="rounded-xl border border-zinc-200 bg-white p-4"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-zinc-800">{n.author_email}</span>
                        <span className="text-zinc-400">{new Date(n.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="mt-2 text-sm text-zinc-700 whitespace-pre-wrap">{n.text}</p>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <EnrichmentSection
                  buyer={buyer}
                  isEditor={isEditor}
                  onBuyerChanged={(updated) => { setBuyer(updated); onBuyerChanged?.(); }}
                />
              </section>

              <section>
                <MoodboardSection
                  buyer={buyer}
                  isEditor={isEditor}
                  onBuyerChanged={(updated) => { setBuyer(updated); onBuyerChanged?.(); }}
                />
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
