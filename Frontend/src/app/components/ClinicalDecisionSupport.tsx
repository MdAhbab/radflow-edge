import { useEffect, useRef, useState } from "react";
import { Activity, ClipboardCopy, Loader2, Sparkles, Stethoscope } from "lucide-react";
import { api, type CaseData, type RiskScoreResult, type TriageReasonResult } from "../../api";
import { toast } from "sonner";

const BAND_STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  moderate: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

/**
 * Compact clinical-decision-support card: deterioration risk (qSOFA + model)
 * plus one-click access to the triage-reasoning and referral-draft agents.
 * Self-contained so it drops into Case Review without touching its logic;
 * all data comes from existing endpoints (/risk/score and the agents).
 */
export function ClinicalDecisionSupport({ caseData }: { caseData: CaseData }) {
  const [risk, setRisk] = useState<RiskScoreResult | null>(null);
  const [reasoning, setReasoning] = useState<TriageReasonResult | null>(null);
  const [referral, setReferral] = useState<string | null>(null);
  const [busy, setBusy] = useState<"reason" | "referral" | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    api
      .riskScore({
        age: caseData.age,
        vitalTemp: caseData.vitalTemp,
        vitalHr: caseData.vitalHr,
        vitalResp: caseData.vitalResp,
        vitalSpo2: caseData.vitalSpo2,
        vitalBp: caseData.vitalBp,
        aiConfidence: caseData.confidence,
      })
      .then((r) => mounted.current && setRisk(r))
      .catch(() => {/* risk card simply stays hidden on failure */});
    return () => {
      mounted.current = false;
    };
    // Re-score when the vitals or confidence change.
  }, [caseData.patientId, caseData.vitalTemp, caseData.vitalHr, caseData.vitalResp, caseData.vitalSpo2, caseData.vitalBp, caseData.confidence, caseData.age]);

  const runReasoning = async () => {
    setBusy("reason");
    try {
      setReasoning(await api.triageReason(caseData.patientId));
    } catch {
      toast.error("Could not run triage reasoning. Is the local model running?");
    } finally {
      setBusy(null);
    }
  };

  const runReferral = async () => {
    setBusy("referral");
    try {
      const { draft } = await api.draftEscalation(caseData.patientId);
      setReferral(draft);
    } catch {
      toast.error("Could not draft the referral note.");
    } finally {
      setBusy(null);
    }
  };

  const copyReferral = () => {
    if (referral) {
      navigator.clipboard?.writeText(referral);
      toast.success("Referral note copied.");
    }
  };

  const band = risk?.riskBand ?? "low";
  const topDrivers = risk
    ? Object.entries(risk.shapContributions)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 3)
        .map(([k]) => k.replace(/^vital_/, "").replace(/_/g, " "))
    : [];

  return (
    <div className="rounded-lg border border-slate-200 border-l-[3px] border-l-blue-500 overflow-hidden">
      <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200 flex items-center gap-1.5">
        <Activity className="w-3.5 h-3.5 text-blue-500" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          AI Decision Support
        </p>
      </div>
      <div className="p-3 space-y-3">
        {/* Deterioration risk */}
        {risk ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600">Deterioration risk</span>
              <span
                className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full border ${BAND_STYLES[band] || BAND_STYLES.low}`}
              >
                {band}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span>qSOFA {risk.qsofaScore}/3</span>
              {risk.modelProbability != null && (
                <span>model {Math.round(risk.modelProbability * 100)}%</span>
              )}
            </div>
            {topDrivers.length > 0 && (
              <p className="text-[11px] text-slate-400">drivers: {topDrivers.join(", ")}</p>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-slate-400">Scoring deterioration risk…</p>
        )}

        {/* Agent actions */}
        <div className="flex gap-2">
          <button
            onClick={runReasoning}
            disabled={busy !== null}
            className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-md border border-slate-200 px-2.5 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {busy === "reason" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-blue-500" />}
            Reasoning
          </button>
          <button
            onClick={runReferral}
            disabled={busy !== null}
            className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-md border border-slate-200 px-2.5 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {busy === "referral" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Stethoscope className="w-3.5 h-3.5 text-blue-500" />}
            Draft referral
          </button>
        </div>

        {/* Reasoning result */}
        {reasoning && (
          <div className="rounded-md bg-blue-50/60 border border-blue-100 p-2.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
                Triage reasoning
              </span>
              <span className="text-[11px] font-medium text-slate-500">→ {reasoning.decision}</span>
            </div>
            <p className="text-xs text-slate-700 whitespace-pre-wrap">{reasoning.reasoning}</p>
            {reasoning.citations.length > 0 && (
              <p className="text-[10px] text-slate-400">{reasoning.citations.join("; ")}</p>
            )}
          </div>
        )}

        {/* Referral draft */}
        {referral && (
          <div className="rounded-md bg-slate-50 border border-slate-200 p-2.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Specialist referral draft
              </span>
              <button onClick={copyReferral} className="text-slate-400 hover:text-slate-700" aria-label="Copy referral">
                <ClipboardCopy className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-slate-700 whitespace-pre-wrap">{referral}</p>
          </div>
        )}
      </div>
    </div>
  );
}
