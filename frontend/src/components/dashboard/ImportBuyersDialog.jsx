import { useState } from "react";
import { apiClient } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";

const ALLOWED_FIELDS = [
  { key: "organization", label: "Organization *", required: true },
  { key: "website", label: "Website" },
  { key: "email", label: "Email" },
  { key: "contact_name", label: "Contact Name" },
  { key: "designation", label: "Designation" },
  { key: "country", label: "Country" },
  { key: "business_type", label: "Business Type" },
  { key: "org_size", label: "Org Size" },
  { key: "purchase_potential", label: "Purchase Potential" },
  { key: "potential_rationale", label: "Potential Rationale" },
  { key: "account_manager", label: "Account Manager" },
  { key: "sources_from_india", label: "Sources From India" },
];

const IGNORE = "__ignore";

function autoMap(columns) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const dict = Object.fromEntries(ALLOWED_FIELDS.map((f) => [norm(f.key), f.key]));
  // add friendly aliases
  const aliases = {
    company: "organization", companyname: "organization", org: "organization", buyer: "organization",
    site: "website", url: "website", domain: "website",
    contact: "contact_name", name: "contact_name",
    role: "designation", title: "designation",
    region: "country", location: "country",
    type: "business_type", segment: "business_type",
    size: "org_size", employees: "org_size",
    potential: "purchase_potential", buyingpotential: "purchase_potential",
    rationale: "potential_rationale", notes: "potential_rationale",
    am: "account_manager", owner: "account_manager", accountmanager: "account_manager",
    india: "sources_from_india", sourcesfromindia: "sources_from_india", sourcesindia: "sources_from_india",
  };
  const out = {};
  for (const c of columns) {
    const k = norm(c);
    out[c] = dict[k] || aliases[k] || IGNORE;
  }
  return out;
}

export default function ImportBuyersDialog({ open, onClose, onImported }) {
  const [step, setStep] = useState(1); // 1=file, 2=map, 3=done
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const reset = () => {
    setStep(1); setFile(null); setPreview(null); setMapping({}); setResult(null); setBusy(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const onFileChosen = async (f) => {
    if (!f) return;
    if (!/\.(csv|xlsx|xls)$/i.test(f.name)) {
      toast.error("Please choose a .csv or .xlsx file");
      return;
    }
    setFile(f);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const { data } = await apiClient.post("/buyers/import/preview", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPreview(data);
      setMapping(autoMap(data.columns || []));
      setStep(2);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not read file");
      setFile(null);
    } finally { setBusy(false); }
  };

  const commit = async () => {
    const mapped = Object.entries(mapping).filter(([, v]) => v && v !== IGNORE);
    const hasOrg = mapped.some(([, v]) => v === "organization");
    if (!hasOrg) {
      toast.error("You must map a column to 'Organization'");
      return;
    }
    // uniqueness: don't allow same buyer field mapped twice
    const seen = new Set();
    for (const [, v] of mapped) {
      if (seen.has(v)) {
        toast.error(`Field '${v}' is mapped to more than one column`);
        return;
      }
      seen.add(v);
    }
    setBusy(true);
    try {
      const cleanMapping = Object.fromEntries(mapped);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mapping", JSON.stringify(cleanMapping));
      const { data } = await apiClient.post("/buyers/import/commit", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
      setStep(3);
      onImported?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Import failed");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden" data-testid="import-dialog">
        <DialogHeader className="px-8 pt-7 pb-4 border-b border-zinc-200 bg-[#fafafa]">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-teal-700 mb-1">Bulk Import</div>
          <DialogTitle className="font-display text-2xl font-black tracking-tight">Import Buyers</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="p-8">
            <label
              data-testid="import-dropzone"
              className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-300 bg-[#fafafa] hover:bg-zinc-50 hover:border-teal-400 transition-colors py-16 cursor-pointer"
            >
              <div className="h-14 w-14 rounded-2xl bg-teal-100 grid place-items-center text-teal-700">
                <Upload className="h-6 w-6" />
              </div>
              <div className="text-sm font-semibold text-zinc-900">
                {busy ? "Reading file…" : "Drop a file or click to browse"}
              </div>
              <div className="text-xs text-zinc-500">Supported: .csv, .xlsx</div>
              <input
                data-testid="import-file-input"
                type="file"
                accept=".csv,.xlsx,.xls"
                className="sr-only"
                disabled={busy}
                onChange={(e) => onFileChosen(e.target.files?.[0])}
              />
            </label>
          </div>
        )}

        {step === 2 && preview && (
          <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto" data-testid="import-mapping">
            <div className="flex items-center gap-3 text-sm text-zinc-600">
              <FileSpreadsheet className="h-4 w-4 text-teal-700" />
              <span className="font-medium text-zinc-900">{file?.name}</span>
              <span className="text-zinc-400">·</span>
              <span>{preview.total_rows} rows · {preview.columns.length} columns</span>
            </div>

            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400 mb-3">Map columns to buyer fields</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {preview.columns.map((col) => (
                  <div
                    key={col}
                    data-testid={`import-map-row-${col}`}
                    className="rounded-xl border border-zinc-200 bg-white p-3 flex items-center gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">From</div>
                      <div className="text-sm font-medium text-zinc-900 truncate">{col}</div>
                      <div className="text-xs text-zinc-500 truncate mt-0.5">
                        e.g. {preview.sample_rows?.[0]?.[col] || "—"}
                      </div>
                    </div>
                    <Select
                      value={mapping[col] || IGNORE}
                      onValueChange={(v) => setMapping({ ...mapping, [col]: v })}
                    >
                      <SelectTrigger className="w-[190px]" data-testid={`import-map-select-${col}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={IGNORE}>— Ignore —</SelectItem>
                        {ALLOWED_FIELDS.map((f) => (
                          <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-4 text-xs text-teal-900 leading-relaxed">
              <b>Dedup rule:</b> rows are matched to existing buyers by website (fallback: organization + email). On a match, mapped fields are updated but AM notes, enrichment, moodboard, outreach fields, and account manager are preserved.
            </div>
          </div>
        )}

        {step === 3 && result && (
          <div className="p-10 text-center" data-testid="import-done">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-teal-100 grid place-items-center text-teal-700 mb-5">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h3 className="font-display text-2xl font-bold text-zinc-900">Import complete</h3>
            <div className="mt-6 grid grid-cols-3 gap-4 max-w-md mx-auto text-sm">
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Inserted</div>
                <div className="mt-1 font-display text-2xl font-black text-teal-700" data-testid="import-inserted">{result.inserted}</div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Updated</div>
                <div className="mt-1 font-display text-2xl font-black text-amber-700" data-testid="import-updated">{result.updated}</div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Skipped</div>
                <div className="mt-1 font-display text-2xl font-black text-zinc-700" data-testid="import-skipped">{result.skipped}</div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="px-8 py-4 border-t border-zinc-200 bg-white flex-row justify-end gap-2">
          {step === 2 && (
            <>
              <button
                onClick={() => { setStep(1); setPreview(null); setFile(null); }}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Back
              </button>
              <button
                data-testid="import-commit-btn"
                onClick={commit}
                disabled={busy}
                className="rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 disabled:opacity-40"
              >
                {busy ? "Importing…" : "Import"}
              </button>
            </>
          )}
          {(step === 1 || step === 3) && (
            <button
              data-testid="import-close-btn"
              onClick={handleClose}
              className="rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium px-4 py-2"
            >
              {step === 3 ? "Done" : "Cancel"}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
