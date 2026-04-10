import { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { 
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Eye,
  AlertCircle,
  Activity,
  TrendingUp,
  FileText,
  Send,
  Mic,
  ChevronDown,
  ChevronUp,
  Loader2
} from "lucide-react";
import { useHeader } from "../AppLayout";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { ScrollArea } from "../ui/scroll-area";
import { api, getImageUrl, CaseData, FindingData } from "../../../api";
import { toast } from "sonner";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function CaseReview() {
  const IMAGE_FRAME_WIDTH = 500;
  const IMAGE_FRAME_HEIGHT = 600;
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { setSlots, clearSlots } = useHeader();
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [findings, setFindings] = useState<FindingData[]>([]);
  const [latestLedger, setLatestLedger] = useState<any | null>(null);
  const [findingsLoading, setFindingsLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(true);
    const pendingPatchRef = useRef<Partial<CaseData>>({});
  const saveTimerRef = useRef<number | null>(null);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [imageLayout, setImageLayout] = useState({
    naturalW: IMAGE_FRAME_WIDTH,
    naturalH: IMAGE_FRAME_HEIGHT,
    displayW: IMAGE_FRAME_WIDTH,
    displayH: IMAGE_FRAME_HEIGHT,
    offsetX: 0,
    offsetY: 0,
  });

  useEffect(() => {
    if (!patientId) return;
    localStorage.setItem("hsil_last_viewed_case", patientId);
    const fetchCase = async () => {
      setLoading(true);
      try {
        const [data, findingsData] = await Promise.all([
          api.getCase(patientId),
          api.getFindings(patientId),
        ]);
        setCaseData(data);
        const sorted = [...findingsData].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
        setFindings(sorted);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load case");
      } finally {
        setLoading(false);
      }
    };
    fetchCase();
  }, [patientId]);

  useEffect(() => {
    if (!patientId) return;
    const fetchLedger = async () => {
      try {
        const rows = await api.getInferenceLedger(patientId, 1);
        setLatestLedger(rows[0] || null);
      } catch {
        setLatestLedger(null);
      }
    };
    fetchLedger();
  }, [patientId, findings]);

  useEffect(() => {
    if (!patientId || !caseData) return;
    let mounted = true;

    const refreshFindings = async () => {
      setFindingsLoading(true);
      try {
        const data = await api.getFindings(patientId);
        if (!mounted) return;
        const sorted = [...data].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
        setFindings(sorted);
      } catch {
        if (mounted) setFindings([]);
      } finally {
        if (mounted) setFindingsLoading(false);
      }
    };

    refreshFindings();
    const timer = setInterval(refreshFindings, 10000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [patientId, caseData]);

  const fmtConfidence = (value?: number | null): number => {
    if (!value) return 0;
    return Math.round(value * (value <= 1 ? 100 : 1));
  };

  const topFinding = findings.length > 0 ? findings[0] : null;
  const caseConfidenceRaw = caseData?.confidence || 0;
  const liveConfidence = topFinding
    ? fmtConfidence(topFinding.confidence)
    : Math.round(caseConfidenceRaw * (caseConfidenceRaw <= 1 ? 100 : 1));
  const hasLiveFindings = findings.length > 0;
  const priorityText = (caseData?.priority || "").toLowerCase();
  const triageColor = (caseData?.triageColor || "").toLowerCase();
  const hasAiOutput =
    (caseData?.aiStatus === "complete" || caseData?.aiStatus === "escalated") ||
    hasLiveFindings ||
    caseConfidenceRaw > 0;
  const highPriorityByFlags =
    caseData?.aiStatus === "escalated" ||
    ["urgent", "immediate", "high priority"].includes(priorityText) ||
    ["red", "orange"].includes(triageColor);
  const showHighPriorityAlert = hasAiOutput && (highPriorityByFlags || liveConfidence >= 50);

  const parseRecommendedSteps = (text?: string | null): string[] => {
    if (!text) return [];
    return text
      .split(/\n+/)
      .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
      .filter((line) => line.length > 8)
      .slice(0, 5);
  };

  const recommendedSteps = parseRecommendedSteps(caseData?.recommendedSteps);

  const handlePromptChip = async (prompt: string) => {
    if (!patientId) return;
    setChatMessages((prev) => [...prev, { role: "user", content: prompt }]);
    setChatLoading(true);
    try {
      const response = await api.askClinicalCopilot(patientId, prompt);
      setChatMessages((prev) => [...prev, { role: "assistant", content: response }]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Unable to reach AI copilot right now. Please try again in a few moments.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !patientId || chatLoading) return;

    const message = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: message }]);
    setChatLoading(true);
    try {
      const response = await api.askClinicalCopilot(patientId, message);
      setChatMessages((prev) => [...prev, { role: "assistant", content: response }]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Unable to reach AI copilot right now. Please try again in a few moments.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const naturalW = img.naturalWidth || IMAGE_FRAME_WIDTH;
    const naturalH = img.naturalHeight || IMAGE_FRAME_HEIGHT;
    const scale = Math.min(IMAGE_FRAME_WIDTH / naturalW, IMAGE_FRAME_HEIGHT / naturalH);
    const displayW = naturalW * scale;
    const displayH = naturalH * scale;
    const offsetX = (IMAGE_FRAME_WIDTH - displayW) / 2;
    const offsetY = (IMAGE_FRAME_HEIGHT - displayH) / 2;
    setImageLayout({ naturalW, naturalH, displayW, displayH, offsetX, offsetY });
  };

  const annotationFindings = findings.filter(
    (f) =>
      f.bbox_x1 != null &&
      f.bbox_y1 != null &&
      f.bbox_x2 != null &&
      f.bbox_y2 != null
  );
  const exp1Annotations = annotationFindings.filter(f => f.source_engine !== "experiment2");
  const exp2Annotations = annotationFindings.filter(f => f.source_engine === "experiment2");
  const isDualView = findings.some(f => f.source_engine === "experiment2") || latestLedger != null;


  const handleIsolate = async () => {
    if (!caseData) return;
    setActionLoading(true);
    await api.updateCase(caseData.patientId, { triageColor: "red", priority: "urgent" });
    const updated = await api.getCase(caseData.patientId);
    setCaseData(updated);
    setActionLoading(false);
  };

  const queueCaseAutosave = (patch: Partial<CaseData>) => {
    if (!caseData) return;

    setCaseData((prev) => (prev ? { ...prev, ...patch } : prev));
    pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
    setAutosaveState("saving");

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(async () => {
      const payload = pendingPatchRef.current;
      pendingPatchRef.current = {};

      try {
        if (patientId) {
          await api.updateCase(patientId, payload);
        }
        setAutosaveState("saved");
        window.setTimeout(() => setAutosaveState("idle"), 1200);
      } catch {
        setAutosaveState("error");
      }
    }, 400);
  };

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const handleEscalate = async () => {
    if (!caseData) return;
    setActionLoading(true);
    try {
      await api.updateCase(caseData.patientId, { aiStatus: "escalated", priority: "immediate", triageColor: "red" });

      const existingEscalations = await api.getEscalations();
      const existing = existingEscalations.find((item) => item.patientId === caseData.patientId);

      if (existing) {
        await api.updateEscalation(caseData.patientId, { status: "awaiting" });
      } else {
        await api.createEscalation({
          patientId: caseData.patientId,
          name: caseData.name,
          age: caseData.age,
          sex: caseData.sex,
          reasonForEscalation: caseData.complaint || "AI flagged this case for specialist review.",
          priority: "immediate",
          aiTriage: (caseData.triageColor === "green" ? "yellow" : caseData.triageColor) as "red" | "orange" | "yellow",
          confidence: caseData.confidence || 0,
          timeWaiting: "0h 0m",
          status: "awaiting",
          assignedTo: undefined,
        });
      }

      toast.success(`Case ${caseData.patientId} escalated to specialist queue.`);
      navigate("/dashboard/escalations");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to escalate case";
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveToEHR = async () => {
    if (!caseData) return;
    setActionLoading(true);
    try {
      await api.updateCase(caseData.patientId, { aiStatus: "complete", isArchived: 1 });
      toast.success(`Case ${caseData.patientId} saved to EHR records.`);
      navigate("/dashboard/ehr");
    } catch (err) {
      toast.error("Failed to save to EHR.");
    } finally {
      setActionLoading(false);
    }
  };

  const runDualConsensus = async () => {
    if (!patientId || !caseData?.imagePath) return;
    setActionLoading(true);
    try {
      const job = await api.createAnalyzeJob({
        patientId,
        imagePath: caseData.imagePath,
        patientContext: `${caseData.age}${caseData.sex}, complaint: ${caseData.complaint}`,
        forceConsensus: true,
        userAction: "consensus_review",
      });

      let final = job;
      for (let i = 0; i < 60; i += 1) {
        if (["completed", "failed", "cancelled"].includes(final.status)) break;
        await new Promise((resolve) => setTimeout(resolve, 1500));
        final = await api.getAnalyzeJob(job.jobId);
      }

      if (final.status === "completed") {
        toast.success("Dual-pipeline consensus run completed.");
        const [updatedCase, updatedFindings, ledgerRows] = await Promise.all([
          api.getCase(patientId),
          api.getFindings(patientId),
          api.getInferenceLedger(patientId, 1),
        ]);
        setCaseData(updatedCase);
        setFindings(updatedFindings.sort((a, b) => (b.confidence || 0) - (a.confidence || 0)));
        setLatestLedger(ledgerRows[0] || null);
      } else if (final.status === "failed") {
        toast.error(final.errorMessage || "Consensus job failed.");
      } else {
        toast.warning("Consensus job did not finish in time. Check System Status for job progress.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to run consensus");
    } finally {
      setActionLoading(false);
    }
  };

  /* ── inject header slots whenever caseData changes ── */
  useEffect(() => {
    if (!caseData) return;

    const studyLabel = caseData.imagePath
      ? caseData.imagePath.split("/").pop()?.split(".")[0] ?? "Study"
      : "Study";

    setSlots({
      left: (
        <div className="flex items-center gap-3 min-w-0">
          {/* Icon-only back button */}
          <Link
            to="/dashboard"
            title="Back to Patient Queue"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900
                       transition-colors duration-150 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="w-px h-5 bg-slate-200 shrink-0" />

          {/* Patient info chip */}
          <div className="flex items-center gap-1.5 text-sm min-w-0 flex-wrap">
            <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100
                             px-1.5 py-0.5 rounded shrink-0">
              {caseData.patientId}
            </span>
            <span className="text-slate-700 font-medium truncate max-w-[140px]">{caseData.name}</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500 shrink-0">{caseData.age} / {caseData.sex}</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500 capitalize shrink-0">{studyLabel}</span>
          </div>
        </div>
      ),
      right: (
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="text-red-700 border-red-300 hover:bg-red-50 h-8 text-xs px-3"
            onClick={handleIsolate}
            disabled={actionLoading}
          >
            <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
            Isolate
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs px-3"
            onClick={handleEscalate}
            disabled={actionLoading}
          >
            <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
            Escalate
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs px-3"
            onClick={runDualConsensus}
            disabled={actionLoading}
          >
            {actionLoading
              ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              : <Activity className="h-3.5 w-3.5 mr-1.5" />
            }
            Consensus
          </Button>
          <Button
            size="sm"
            className="bg-slate-900 hover:bg-slate-800 h-8 text-xs px-3"
            onClick={handleSaveToEHR}
            disabled={actionLoading}
          >
            {actionLoading
              ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              : <FileText className="h-3.5 w-3.5 mr-1.5" />
            }
            Save to EHR
          </Button>
        </div>
      ),
    });

    return () => clearSlots();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseData, actionLoading]);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
        <p className="text-slate-500 mt-4">Loading clinical context...</p>
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-50 text-red-500">
        <AlertCircle className="h-8 w-8 mb-2" />
        <p>{error || "Case not found"}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Main Content - 3 Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Patient Context */}
        <div className="w-80 border-r border-slate-200 bg-white overflow-auto">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">

              {/* Autosave status — compact top strip */}
              <div className="flex items-center gap-1.5 px-1">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  autosaveState === "saving" ? "bg-blue-400 animate-pulse" :
                  autosaveState === "saved"  ? "bg-emerald-400" :
                  autosaveState === "error"  ? "bg-red-400" : "bg-slate-300"
                }`} />
                <span className="text-[11px] text-slate-500">
                  {autosaveState === "saving" ? "Saving…" :
                   autosaveState === "saved"  ? "All changes saved" :
                   autosaveState === "error"  ? "Save failed — will retry" : "Edits auto-saved"}
                </span>
              </div>

              {/* ── DEMOGRAPHICS ── */}
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Demographics</p>
                </div>
                <div className="px-3.5 py-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 items-baseline">
                  <span className="text-xs text-slate-500 whitespace-nowrap">Patient ID</span>
                  <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded w-fit">
                    {caseData.patientId}
                  </span>

                  <span className="text-xs text-slate-500">Name</span>
                  <span className="text-sm font-semibold text-slate-900">{caseData.name}</span>

                  <span className="text-xs text-slate-500">Age / Sex</span>
                  <span className="text-sm text-slate-800">{caseData.age} y / {caseData.sex}</span>

                  <span className="text-xs text-slate-500">Study Type</span>
                  <span className="text-sm text-slate-800">{caseData.studyType}</span>

                  <span className="text-xs text-slate-500">Study Time</span>
                  <span className="text-sm text-slate-800">{caseData.timeReceived}</span>
                </div>
              </div>

              {/* ── PRESENTING COMPLAINT ── */}
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Presenting Complaint</p>
                </div>
                <div className="px-3.5 py-3">
                  <div className="border-l-[3px] border-blue-500 pl-3 py-1">
                    <p className="text-sm text-slate-900 font-medium leading-relaxed">{caseData.complaint}</p>
                  </div>
                </div>
              </div>

              {/* ── VITAL SIGNS ── */}
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Vital Signs</p>
                </div>
                <div className="p-3 grid grid-cols-2 gap-2">
                  {([
                    { label: "TEMP",  unit: "°C",   type: "number", step: "0.1", value: caseData.vitalTemp,   key: "vitalTemp"   as const },
                    { label: "HR",    unit: "bpm",  type: "number", step: "1",   value: caseData.vitalHr,     key: "vitalHr"     as const },
                    { label: "BP",    unit: "mmHg", type: "text",   step: "",    value: caseData.vitalBp,     key: "vitalBp"     as const },
                    { label: "RESP",  unit: "/min", type: "number", step: "1",   value: caseData.vitalResp,   key: "vitalResp"   as const },
                    { label: "SpO₂",  unit: "%",    type: "number", step: "0.1", value: caseData.vitalSpo2,   key: "vitalSpo2"   as const },
                    { label: "WT",    unit: "kg",   type: "number", step: "0.1", value: caseData.vitalWeight, key: "vitalWeight" as const },
                  ] as Array<{ label: string; unit: string; type: string; step: string; value: number | string | undefined; key: keyof typeof caseData }>).map((v) => (
                    <div key={v.key} className="bg-slate-50/80 rounded-md px-2.5 py-2 flex flex-col gap-1 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 tracking-wide">{v.label}</span>
                        <span className="text-[10px] text-slate-400">{v.unit}</span>
                      </div>
                      <Input
                        className="h-6 text-sm bg-white border-slate-200 px-2 text-slate-800 focus-visible:ring-blue-500/40"
                        type={v.type}
                        step={v.step || undefined}
                        value={v.value ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (v.type === "text") {
                            queueCaseAutosave({ [v.key]: raw || undefined } as Partial<CaseData>);
                          } else {
                            queueCaseAutosave({ [v.key]: raw ? Number(raw) : undefined } as Partial<CaseData>);
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* ── RISK FACTORS & HISTORY ── */}
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Risk Factors & History</p>
                </div>
                <div className="p-3">
                  <Textarea
                    rows={3}
                    className="text-sm resize-none border-slate-200"
                    value={caseData.riskFactors ?? ""}
                    placeholder="Smoking, previous TB exposure, immunocompromised state…"
                    onChange={(e) => queueCaseAutosave({ riskFactors: e.target.value || undefined })}
                  />
                </div>
              </div>

              {/* ── CLINICAL NOTES ── */}
              <div className="rounded-lg border border-slate-200 border-l-[3px] border-l-amber-400 overflow-hidden">
                <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Clinical Notes</p>
                </div>
                <div className="p-3">
                  <Textarea
                    rows={4}
                    className="text-sm resize-none border-slate-200"
                    value={caseData.clinicalNotes ?? ""}
                    placeholder="Clinician notes…"
                    onChange={(e) => queueCaseAutosave({ clinicalNotes: e.target.value || undefined })}
                  />
                </div>
              </div>

              {/* ── DIFFERENTIAL & PLAN ── */}
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Differential & Plan</p>
                </div>
                <div className="p-3 space-y-3">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-slate-600">Differential Diagnosis</p>
                    <Textarea
                      rows={3}
                      className="text-sm resize-none border-slate-200"
                      value={caseData.differentialDiagnosis ?? ""}
                      onChange={(e) => queueCaseAutosave({ differentialDiagnosis: e.target.value || undefined })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-slate-600">Recommended Steps</p>
                    <Textarea
                      rows={3}
                      className="text-sm resize-none border-slate-200"
                      value={caseData.recommendedSteps ?? ""}
                      onChange={(e) => queueCaseAutosave({ recommendedSteps: e.target.value || undefined })}
                    />
                  </div>
                </div>
              </div>

            </div>
          </ScrollArea>
        </div>

        {/* Center Panel - Image Viewer */}
        <div className="flex-1 flex flex-col bg-slate-900 relative">
          {/* Image Controls */}
          <div className="absolute top-4 left-4 z-10 flex gap-2">
            <Button 
              size="sm" 
              variant="secondary"
              onClick={() => setZoom(Math.min(zoom + 25, 200))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button 
              size="sm" 
              variant="secondary"
              onClick={() => setZoom(Math.max(zoom - 25, 50))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setZoom(100)}>
              <RotateCw className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="h-8" />
            <Button 
              size="sm" 
              variant={showAnnotations ? "default" : "secondary"}
              onClick={() => setShowAnnotations(!showAnnotations)}
            >
              <Eye className="h-4 w-4 mr-2" />
              AI Annotations
            </Button>
            <Badge variant="secondary" className="ml-2">
              Zoom: {zoom}%
            </Badge>
          </div>

          {/* X-Ray Image */}
          <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
            <div className="relative flex flex-col xl:flex-row gap-8" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}>
              
              {/* Image 1 - Exp 1 */}
              <div className="flex flex-col items-center gap-2">
                {isDualView && <h3 className="text-slate-300 font-medium text-sm">Experiment 1 (Detector & Analyzer)</h3>}
                <div className="w-[500px] h-[600px] bg-slate-800 rounded-lg border-2 border-slate-700 relative overflow-hidden shadow-2xl">
                  {/* Simulated X-ray gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 opacity-80"></div>
                  
                  {caseData?.imagePath ? (
                    <img 
                      src={getImageUrl(caseData.imagePath)} 
                      className="absolute inset-0 w-full h-full object-contain mix-blend-screen opacity-80 pointer-events-none" 
                      alt="Patient Radiograph" 
                      onLoad={handleImageLoad}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center"><div className="w-16 h-16 border-4 border-slate-600 border-t-slate-400 rounded-full animate-spin"></div></div>
                  )}

                  {showAnnotations && (
                    <>
                      {(isDualView ? exp1Annotations : annotationFindings).map((finding, idx) => {
                        const x1 = finding.bbox_x1 as number;
                        const y1 = finding.bbox_y1 as number;
                        const x2 = finding.bbox_x2 as number;
                        const y2 = finding.bbox_y2 as number;
                        const left = imageLayout.offsetX + (x1 / imageLayout.naturalW) * imageLayout.displayW;
                        const top = imageLayout.offsetY + (y1 / imageLayout.naturalH) * imageLayout.displayH;
                        const width = Math.max(12, ((x2 - x1) / imageLayout.naturalW) * imageLayout.displayW);
                        const height = Math.max(12, ((y2 - y1) / imageLayout.naturalH) * imageLayout.displayH);
                        const isPrimary = idx === 0;
                        const boxClass = isPrimary ? "border-red-500" : "border-orange-400";
                        const labelClass = isPrimary ? "bg-red-500" : "bg-orange-500";
                        return (
                          <div
                            key={`ann1-${idx}-${finding.disease}`}
                            className={`absolute border-2 ${boxClass} rounded-md shadow-lg transition-colors hover:bg-${isPrimary ? 'red' : 'orange'}-500/10`}
                            style={{ left, top, width, height }}
                          >
                            <div className={`absolute -top-6 left-0 ${labelClass} text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap`}>
                              {finding.disease.replace(/_/g, " ")}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* Image metadata overlay */}
                  <div className="absolute bottom-2 left-2 text-xs text-slate-400 font-mono">
                    <div>{caseData?.patientId} | {caseData?.studyType}</div>
                    <div>{caseData?.timeReceived}</div>
                  </div>
                </div>
              </div>

              {/* Image 2 - Exp 2 (Only if Dual View) */}
              {isDualView && (
                <div className="flex flex-col items-center gap-2">
                  <h3 className="text-slate-300 font-medium text-sm">Experiment 2 (Foveal & Reasoner)</h3>
                  <div className="w-[500px] h-[600px] bg-slate-800 rounded-lg border-2 border-slate-700 relative overflow-hidden shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 opacity-80"></div>
                    
                    {caseData?.imagePath ? (
                      <img 
                        src={getImageUrl(caseData.imagePath)} 
                        className="absolute inset-0 w-full h-full object-contain mix-blend-screen opacity-80 pointer-events-none" 
                        alt="Patient Radiograph" 
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center"><div className="w-16 h-16 border-4 border-slate-600 border-t-slate-400 rounded-full animate-spin"></div></div>
                    )}

                    {showAnnotations && (
                      <>
                        {exp2Annotations.map((finding, idx) => {
                          const x1 = finding.bbox_x1 as number;
                          const y1 = finding.bbox_y1 as number;
                          const x2 = finding.bbox_x2 as number;
                          const y2 = finding.bbox_y2 as number;
                          const left = imageLayout.offsetX + (x1 / imageLayout.naturalW) * imageLayout.displayW;
                          const top = imageLayout.offsetY + (y1 / imageLayout.naturalH) * imageLayout.displayH;
                          const width = Math.max(12, ((x2 - x1) / imageLayout.naturalW) * imageLayout.displayW);
                          const height = Math.max(12, ((y2 - y1) / imageLayout.naturalH) * imageLayout.displayH);
                          const isPrimary = idx === 0;
                          const boxClass = isPrimary ? "border-red-500" : "border-orange-400";
                          const labelClass = isPrimary ? "bg-red-500" : "bg-orange-500";
                          return (
                            <div
                              key={`ann2-${idx}-${finding.disease}`}
                              className={`absolute border-2 ${boxClass} rounded-md shadow-lg transition-colors hover:bg-${isPrimary ? 'red' : 'orange'}-500/10`}
                              style={{ left, top, width, height }}
                            >
                              <div className={`absolute -top-6 left-0 ${labelClass} text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap`}>
                                {finding.disease.replace(/_/g, " ")}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}

                    <div className="absolute bottom-2 left-2 text-xs text-slate-400 font-mono">
                      <div>{caseData?.patientId} | {caseData?.studyType}</div>
                      <div>{caseData?.timeReceived}</div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Right Panel - AI Findings */}
        <div className="w-96 border-l border-slate-200 bg-white overflow-auto">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">

              {/* ── AI STATUS BANNER ── */}
              {showHighPriorityAlert ? (
                <div className="rounded-lg border border-red-200 border-l-[3px] border-l-red-500 bg-red-50/30 px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-red-600">High Priority</p>
                    <Badge variant="destructive" className="text-[11px]">
                      {topFinding?.disease?.replace(/_/g, " ") || "Critical finding"}
                    </Badge>
                  </div>
                </div>
              ) : hasAiOutput ? (
                <div className="rounded-lg border border-amber-200 border-l-[3px] border-l-amber-400 bg-amber-50/30 px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Needs Review</p>
                    <Badge variant="outline" className="text-[11px] border-amber-300 text-amber-700">
                      low confidence
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    AI output available but confidence is below escalation threshold. Review with clinical context.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-blue-100 bg-blue-50/30 py-5 flex flex-col items-center gap-2">
                  <Activity className="h-6 w-6 text-blue-500 animate-pulse" />
                  <p className="text-sm font-semibold text-slate-700">AI Triage in Progress</p>
                  <p className="text-xs text-slate-500">Automatic prioritization and clinical tagging…</p>
                </div>
              )}

              {/* ── AI CONFIDENCE ── */}
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">AI Confidence</p>
                  {hasAiOutput && (
                    <span className={`text-sm font-bold tabular-nums
                      ${liveConfidence >= 85 ? "text-emerald-600" : liveConfidence >= 70 ? "text-amber-600" : "text-red-600"}`}>
                      {liveConfidence}%
                    </span>
                  )}
                </div>
                <div className="px-3.5 py-3">
                  {hasAiOutput ? (
                    <div className="space-y-1.5">
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500
                            ${liveConfidence >= 85 ? "bg-emerald-500" : liveConfidence >= 70 ? "bg-amber-400" : "bg-red-500"}`}
                          style={{ width: `${liveConfidence}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-500">
                        {hasLiveFindings ? "Live — from current model findings" : "Case-level confidence"}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">
                      {caseData.aiStatus === "analyzing" ? "Analysis in progress…" : "Awaiting AI output"}
                    </p>
                  )}
                </div>
              </div>

              {/* ── MODEL CONSENSUS ── */}
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Model Consensus</p>
                </div>
                <div className="px-3.5 py-3">
                  {latestLedger ? (
                    <div className="space-y-2.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Consensus</span>
                        <Badge
                          variant={latestLedger.consensusState === "disagree" ? "destructive" : "outline"}
                          className="text-[11px] capitalize"
                        >
                          {latestLedger.consensusState || "not run"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Risk Band</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full shrink-0
                            ${latestLedger.riskBand === "high"   ? "bg-red-500"    :
                              latestLedger.riskBand === "medium" ? "bg-amber-400"  : "bg-emerald-500"}`}
                          />
                          <span className="text-slate-800 capitalize font-medium">{latestLedger.riskBand || "low"}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Uncertainty</span>
                        <span className="text-slate-800 font-medium">
                          {Math.round((latestLedger.uncertainty || 0) * 100)}%
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No ledger entry yet for this case.</p>
                  )}
                </div>
              </div>

              {/* ── KEY FINDINGS ── */}
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Key Findings</p>
                </div>
                <div className="px-3.5 py-3">
                  {findingsLoading ? (
                    <p className="text-xs text-slate-500 italic">Refreshing live findings…</p>
                  ) : findings.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No live findings available yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {findings.slice(0, 5).map((finding, idx) => {
                        const conf = fmtConfidence(finding.confidence);
                        return (
                          <div key={`${finding.disease}-${idx}`} className="flex items-start gap-2.5">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5
                              ${idx === 0 ? "bg-red-100 text-red-700 ring-1 ring-red-200" : "bg-slate-100 text-slate-600"}`}>
                              {idx + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium text-slate-900 capitalize leading-tight">
                                  {finding.disease.replace(/_/g, " ")}
                                </p>
                                <span className={`text-xs font-semibold tabular-nums shrink-0
                                  ${conf >= 85 ? "text-emerald-600" : conf >= 70 ? "text-amber-600" : "text-slate-500"}`}>
                                  {conf}%
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ── DIFFERENTIAL DIAGNOSIS ── */}
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Differential Diagnosis</p>
                </div>
                <div className="px-3.5 py-3">
                  {caseData.differentialDiagnosis ? (
                    <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {caseData.differentialDiagnosis}
                    </p>
                  ) : findings.length > 0 ? (
                    <div className="space-y-2">
                      {findings.slice(0, 3).map((finding, idx) => (
                        <div key={`ddx-${idx}`} className="flex items-center justify-between">
                          <span className="text-sm text-slate-800 capitalize">
                            {finding.disease.replace(/_/g, " ")}
                          </span>
                          <Badge
                            variant={idx === 0 ? "destructive" : "outline"}
                            className="text-[11px]"
                          >
                            {idx === 0 ? "Primary" : "Consider"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No differential generated yet.</p>
                  )}
                </div>
              </div>

              {/* ── RECOMMENDED NEXT STEPS ── */}
              <div className="rounded-lg border border-slate-200 border-l-[3px] border-l-blue-500 overflow-hidden">
                <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">Recommended Next Steps</p>
                </div>
                <div className="px-3.5 py-3">
                  {recommendedSteps.length > 0 ? (
                    <div className="space-y-2">
                      {recommendedSteps.map((step, idx) => (
                        <div key={`step-${idx}`} className="flex items-start gap-2 text-sm text-slate-800">
                          <span className="shrink-0 font-semibold text-blue-500 tabular-nums">{idx + 1}.</span>
                          <span className="leading-snug">{step}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">
                      No model-generated recommendations yet. Trigger analysis to populate.
                    </p>
                  )}
                </div>
              </div>

              {/* ── AI DRAFT REPORT ── */}
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">AI Draft Report</p>
                </div>
                <div className="px-3.5 py-3">
                  <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {caseData.aiDraftReport || "AI Draft Report has not been generated for this case."}
                  </p>
                </div>
              </div>

            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Bottom AI Chat Panel */}
      <div className="border-t border-slate-200 bg-white">
        <div 
          className="border-b border-slate-200 px-6 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50"
          onClick={() => setChatExpanded(!chatExpanded)}
        >
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-slate-900">AI Clinical Copilot</span>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              Ask Questions
            </Badge>
          </div>
          {chatExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </div>

        {chatExpanded && (
          <div className="px-6 py-4 space-y-4">
            {/* Prompt Chips */}
            {chatMessages.length === 0 && (
              <div className="flex flex-wrap gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handlePromptChip("Explain the main finding in simple terms")}
                >
                  Explain main finding
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handlePromptChip("Show me where the abnormal region is")}
                >
                  Show abnormal region
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handlePromptChip("Could this be TB? Walk me through the evidence")}
                >
                  Could this be TB?
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handlePromptChip("What should I do next for this patient?")}
                >
                  What should I do next?
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handlePromptChip("Why is the confidence not higher?")}
                >
                  Why not 100% confidence?
                </Button>
              </div>
            )}

            {/* Chat Messages */}
            {chatMessages.length > 0 && (
              <ScrollArea className="h-64 pr-4">
                <div className="space-y-4">
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`
                        max-w-[80%] rounded-lg px-4 py-2.5 text-sm
                        ${msg.role === "user" 
                          ? "bg-slate-900 text-white" 
                          : "bg-blue-50 text-slate-900 border border-blue-200"
                        }
                      `}>
                        {msg.role === "assistant" && (
                          <div className="flex items-center gap-1.5 mb-1 text-xs text-blue-700">
                            <Activity className="h-3 w-3" />
                            <span className="font-medium">AI Copilot</span>
                          </div>
                        )}
                        <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {chatLoading && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                AI copilot is thinking...
              </div>
            )}

            {/* Chat Input */}
            <div className="flex gap-2">
              <Input 
                placeholder="Ask a question about this case..." 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                className="flex-1"
              />
              <Button size="icon" variant="outline">
                <Mic className="h-4 w-4" />
              </Button>
              <Button onClick={handleSendMessage} disabled={chatLoading || !chatInput.trim()}>
                <Send className="h-4 w-4 mr-2" />
                Send
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}