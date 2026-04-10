import { useState, useEffect, useRef } from "react";
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
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
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
  const [genexpertOrdered, setGenexpertOrdered] = useState(false);
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
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Worklist
              </Button>
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Case Review: {caseData.patientId}</h2>
              <p className="text-sm text-slate-600">{caseData.name} - {caseData.age} / {caseData.sex}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="text-red-700 border-red-300 hover:bg-red-50" onClick={handleIsolate} disabled={actionLoading}>
              <AlertCircle className="h-4 w-4 mr-2" />
              Isolate Patient
            </Button>
            <Button 
              variant={genexpertOrdered ? "secondary" : "outline"} 
              className={genexpertOrdered ? "bg-green-50 text-green-700 hover:bg-green-100 border-green-200" : ""}
              onClick={() => setGenexpertOrdered(true)}
            >
              <Activity className="h-4 w-4 mr-2" />
              {genexpertOrdered ? "GeneXpert Ordered" : "Order GeneXpert"}
            </Button>
            <Button variant="outline" onClick={handleEscalate} disabled={actionLoading}>
              <TrendingUp className="h-4 w-4 mr-2" />
              Escalate to Specialist
            </Button>
            <Button variant="outline" onClick={runDualConsensus} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Activity className="h-4 w-4 mr-2" />}
              Run Dual Consensus
            </Button>
            <Button className="bg-slate-900 hover:bg-slate-800" onClick={handleSaveToEHR} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
              Save to EHR
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content - 3 Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Patient Context */}
        <div className="w-80 border-r border-slate-200 bg-white overflow-auto">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              <div className="text-xs px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-slate-600">
                {autosaveState === "saving" && "Saving patient details..."}
                {autosaveState === "saved" && "All patient details saved."}
                {autosaveState === "error" && "Auto-save failed. Keep editing; retry will happen on next change."}
                {autosaveState === "idle" && "Patient detail edits are auto-saved."}
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Demographics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Patient ID:</span>
                    <span className="font-mono">{caseData.patientId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Name:</span>
                    <span className="font-medium">{caseData.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Age / Sex:</span>
                    <span>{caseData.age} years / {caseData.sex}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Study Type:</span>
                    <span>{caseData.studyType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Study Time:</span>
                    <span>{caseData.timeReceived}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Presenting Complaint</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {caseData.complaint}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Vital Signs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Temperature:</span>
                    <Input
                      className="h-7 w-28 text-right"
                      type="number"
                      step="0.1"
                      value={caseData.vitalTemp ?? ""}
                      onChange={(e) => queueCaseAutosave({ vitalTemp: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Heart Rate:</span>
                    <Input
                      className="h-7 w-28 text-right"
                      type="number"
                      value={caseData.vitalHr ?? ""}
                      onChange={(e) => queueCaseAutosave({ vitalHr: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">BP:</span>
                    <Input
                      className="h-7 w-28 text-right"
                      value={caseData.vitalBp ?? ""}
                      onChange={(e) => queueCaseAutosave({ vitalBp: e.target.value || undefined })}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Resp Rate:</span>
                    <Input
                      className="h-7 w-28 text-right"
                      type="number"
                      value={caseData.vitalResp ?? ""}
                      onChange={(e) => queueCaseAutosave({ vitalResp: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">SpO2:</span>
                    <Input
                      className="h-7 w-28 text-right"
                      type="number"
                      step="0.1"
                      value={caseData.vitalSpo2 ?? ""}
                      onChange={(e) => queueCaseAutosave({ vitalSpo2: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Weight:</span>
                    <Input
                      className="h-7 w-28 text-right"
                      type="number"
                      step="0.1"
                      value={caseData.vitalWeight ?? ""}
                      onChange={(e) => queueCaseAutosave({ vitalWeight: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Risk Factors & History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <Textarea
                    rows={3}
                    value={caseData.riskFactors ?? ""}
                    placeholder="Smoking, previous TB exposure, immunocompromised state..."
                    onChange={(e) => queueCaseAutosave({ riskFactors: e.target.value || undefined })}
                  />
                </CardContent>
              </Card>

              <Card className="bg-amber-50 border-amber-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-amber-900">Clinical Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    rows={4}
                    className="bg-white"
                    value={caseData.clinicalNotes ?? ""}
                    placeholder="Clinician notes..."
                    onChange={(e) => queueCaseAutosave({ clinicalNotes: e.target.value || undefined })}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Differential & Plan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Differential Diagnosis</div>
                    <Textarea
                      rows={3}
                      value={caseData.differentialDiagnosis ?? ""}
                      onChange={(e) => queueCaseAutosave({ differentialDiagnosis: e.target.value || undefined })}
                    />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Recommended Steps</div>
                    <Textarea
                      rows={3}
                      value={caseData.recommendedSteps ?? ""}
                      onChange={(e) => queueCaseAutosave({ recommendedSteps: e.target.value || undefined })}
                    />
                  </div>
                </CardContent>
              </Card>
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
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="relative" style={{ transform: `scale(${zoom / 100})` }}>
              {/* Placeholder X-ray with annotations */}
              <div className="w-[500px] h-[600px] bg-slate-800 rounded-lg border-2 border-slate-700 relative overflow-hidden">
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
                  <svg viewBox="0 0 500 600" className="absolute inset-0 w-full h-full opacity-40">
                    {/* Right lung */}
                    <ellipse cx="180" cy="300" rx="120" ry="200" fill="#666" />
                    {/* Left lung */}
                    <ellipse cx="320" cy="300" rx="120" ry="200" fill="#666" />
                    {/* Trachea */}
                    <rect x="240" y="50" width="20" height="150" fill="#555" />
                  </svg>
                )}

                {showAnnotations && (
                  <>
                    {annotationFindings.map((finding, idx) => {
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
                          key={`ann-${idx}-${finding.disease}`}
                          className={`absolute border-2 ${boxClass} rounded-md shadow-lg`}
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
                  <div>{caseData.patientId} | {caseData.studyType}</div>
                  <div>{caseData.timeReceived}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - AI Findings */}
        <div className="w-96 border-l border-slate-200 bg-white overflow-auto">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {/* AI Status Banner - Shows when analysis is complete or pending */}
              {showHighPriorityAlert ? (
                <Card className="border-red-300 bg-red-50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-semibold text-red-900">High Priority</CardTitle>
                      <Badge variant="destructive" className="text-sm">
                        {topFinding?.disease || "Critical finding"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-red-800 leading-relaxed">
                      {topFinding?.report || caseData.aiDraftReport || "AI analysis is complete. Review findings and proceed with clinical decision making."}
                    </p>
                  </CardContent>
                </Card>
              ) : hasAiOutput ? (
                <Card className="border-amber-300 bg-amber-50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-semibold text-amber-900">Needs Review</CardTitle>
                      <Badge variant="outline" className="text-sm border-amber-300 text-amber-800">
                        low confidence
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-amber-900 leading-relaxed">
                      AI output is available, but confidence is below the escalation threshold. Review with clinical context before urgent actions.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                 <Card className="border-blue-100 bg-blue-50/50">
                   <CardContent className="py-6 text-center">
                     <Activity className="h-8 w-8 text-blue-500 animate-pulse mx-auto mb-3" />
                     <p className="text-sm font-medium text-blue-900">AI Triage in Progress</p>
                     <p className="text-xs text-blue-700 mt-1">Automatic prioritization and clinical tagging...</p>
                   </CardContent>
                 </Card>
              )}

              {/* Confidence Score - Only show if data is ready */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">AI Confidence</CardTitle>
                </CardHeader>
                <CardContent>
                  {hasAiOutput ? (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500" 
                              style={{ width: `${liveConfidence}%` }}
                            ></div>
                          </div>
                        </div>
                        <span className="text-2xl font-semibold text-green-700">
                          {liveConfidence}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-2">
                        {hasLiveFindings ? "Live confidence from current model findings." : "Using case-level confidence."}
                      </p>
                    </>
                  ) : (
                    <div className="py-4 text-center">
                      {caseData.aiStatus === "analyzing" ? (
                        <>
                          <Loader2 className="h-6 w-6 animate-spin text-slate-400 mx-auto mb-2" />
                          <p className="text-sm text-slate-500 italic">AI Analysis in Progress...</p>
                        </>
                      ) : (
                        <p className="text-sm text-slate-500 italic">Confidence will appear once AI output is available.</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Model Consensus</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {latestLedger ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Consensus State</span>
                        <Badge variant={latestLedger.consensusState === "disagree" ? "destructive" : "outline"}>
                          {latestLedger.consensusState || "not_run"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Risk Band</span>
                        <Badge variant="outline">{latestLedger.riskBand || "low"}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Calibrated Confidence</span>
                        <span className="font-semibold text-slate-900">{Math.round((latestLedger.calibratedConfidence || 0) * 100)}%</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-slate-500 italic">No ledger entry yet for this case.</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Rationale & Safety</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {latestLedger ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Uncertainty</span>
                        <span>{Math.round((latestLedger.uncertainty || 0) * 100)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Expected Error Bin</span>
                        <span className="capitalize">{latestLedger.expectedErrorBin || "n/a"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Policy Action</span>
                        <span className="capitalize">{latestLedger.policyAction || "no_change"}</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-slate-500 italic">Run analysis to populate rationale details.</div>
                  )}
                </CardContent>
              </Card>

              {/* Key Findings */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Key Findings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {findingsLoading ? (
                    <div className="py-2 text-sm text-slate-500 italic">Refreshing live findings...</div>
                  ) : findings.length === 0 ? (
                    <div className="py-2 text-sm text-slate-500 italic">No live findings available for this case yet.</div>
                  ) : (
                    findings.slice(0, 5).map((finding, idx) => {
                      const badgeVariant = idx === 0 ? "destructive" : "outline";
                      const conf = fmtConfidence(finding.confidence);
                      return (
                        <div key={`${finding.disease}-${idx}`} className="flex items-start gap-2">
                          <Badge variant={badgeVariant} className="shrink-0 mt-0.5">{idx + 1}</Badge>
                          <div className="text-sm">
                            <div className="font-medium text-slate-900">{finding.disease.replace(/_/g, " ")}</div>
                            <div className="text-slate-600 text-xs mt-0.5">
                              Confidence: {conf}%
                              {finding.bbox_x1 != null && finding.bbox_y1 != null && finding.bbox_x2 != null && finding.bbox_y2 != null
                                ? ` | BBox: (${finding.bbox_x1}, ${finding.bbox_y1})-(${finding.bbox_x2}, ${finding.bbox_y2})`
                                : ""}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              {/* Differential Diagnosis */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Differential Diagnosis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {caseData.differentialDiagnosis ? (
                    <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">{caseData.differentialDiagnosis}</div>
                  ) : findings.length > 0 ? (
                    findings.slice(0, 3).map((finding, idx) => (
                      <div key={`ddx-${idx}`} className="flex items-center justify-between">
                        <span className="text-slate-700">{finding.disease.replace(/_/g, " ")}</span>
                        <Badge variant={idx === 0 ? "destructive" : "outline"}>{idx === 0 ? "Primary" : "Consider"}</Badge>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 italic">No differential diagnosis has been generated yet.</div>
                  )}
                </CardContent>
              </Card>

              {/* Recommended Actions */}
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-blue-900">Recommended Next Steps</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-blue-800">
                  {recommendedSteps.length > 0 ? (
                    recommendedSteps.map((step, idx) => (
                      <div key={`step-${idx}`} className="flex items-start gap-2">
                        <span className="shrink-0 font-semibold">{idx + 1}.</span>
                        <span>{step}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-blue-800">No model-generated recommendations yet. Trigger analysis from the current experiment to populate this section.</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">AI Draft Report</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm space-y-2 text-slate-700 leading-relaxed">
                    <div className="whitespace-pre-wrap">{caseData.aiDraftReport || 'AI Draft Report has not been generated for this case.'}</div>
                  </div>
                </CardContent>
              </Card>
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