import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { X, Save } from "lucide-react";

function TagInput({ value, onChange, placeholder, testid, disabled }) {
  const [draft, setDraft] = useState("");
  const add = () => { const t = draft.trim(); if (t && !value.includes(t)) onChange([...value, t]); setDraft(""); };
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-2 flex flex-wrap gap-1.5" data-testid={testid}>
      {value.map((t, i) => (
        <span key={i} className="inline-flex items-center gap-1 bg-teal-50 border border-teal-200 text-teal-800 rounded-full pl-3 pr-1 py-0.5 text-xs font-medium">
          {t}{!disabled && <button onClick={() => onChange(value.filter((_, j) => j !== i))} className="hover:bg-teal-100 rounded-full p-0.5"><X className="h-3 w-3" /></button>}
        </span>
      ))}
      {!disabled && <input value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
        onBlur={add} placeholder={placeholder}
        className="flex-1 min-w-[140px] px-2 py-1 text-sm outline-none bg-transparent" />}
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const isEditor = user?.role === "editor";
  const [p, setP] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { apiClient.get("/settings/qalara_profile").then(({data}) => setP({about:"",categories:[],producer_base:"",moqs:"",export_markets:[],certifications:[],value_props:[],...data})); }, []);

  if (!p) return <div className="text-zinc-500">Loading…</div>;

  const set = (k, v) => setP({ ...p, [k]: v });
  const save = async () => { setSaving(true); try { await apiClient.put("/settings/qalara_profile", p); toast.success("Profile saved"); } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); } finally { setSaving(false); } };

  return (
    <div className="max-w-4xl space-y-6" data-testid="settings-page">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-teal-700">Configuration</p>
        <h1 className="mt-2 font-display text-4xl sm:text-5xl font-black tracking-tight">Qalara Capability Profile</h1>
        <p className="mt-3 text-zinc-600">This powers outreach personalization — everything here is fed into every AI-drafted email.</p>
      </div>

      {[
        ["About Qalara","about","textarea"],
        ["Categories","categories","tags"],
        ["Producer Base","producer_base","textarea"],
        ["MOQs","moqs","text"],
        ["Export Markets","export_markets","tags"],
        ["Certifications","certifications","tags"],
        ["Value Props","value_props","tags"],
      ].map(([label, k, kind]) => (
        <div key={k} className="rounded-xl border border-zinc-200 bg-white p-5">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{label}</label>
          <div className="mt-2">
            {kind === "textarea" && (
              <textarea data-testid={`settings-${k}`} disabled={!isEditor} value={p[k]} onChange={(e) => set(k, e.target.value)} rows={4}
                className="w-full rounded-lg border border-zinc-200 p-3 text-sm resize-none focus:outline-none focus:border-teal-500 disabled:bg-zinc-50" />
            )}
            {kind === "text" && (
              <input data-testid={`settings-${k}`} disabled={!isEditor} value={p[k]} onChange={(e) => set(k, e.target.value)}
                className="w-full rounded-lg border border-zinc-200 p-3 text-sm focus:outline-none focus:border-teal-500 disabled:bg-zinc-50" />
            )}
            {kind === "tags" && (
              <TagInput testid={`settings-${k}`} value={p[k] || []} onChange={(v) => set(k, v)} placeholder="Type and press Enter…" disabled={!isEditor} />
            )}
          </div>
        </div>
      ))}

      {isEditor && (
        <div className="sticky bottom-4 flex justify-end">
          <button data-testid="settings-save-btn" onClick={save} disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-medium px-5 py-2.5 shadow-lg">
            <Save className="h-4 w-4" />{saving ? "Saving…" : "Save Profile"}
          </button>
        </div>
      )}
    </div>
  );
}
