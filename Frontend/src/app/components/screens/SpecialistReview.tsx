import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import { useHeader } from "../AppLayout";
import { 
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Eye,
  AlertCircle,
  FileEdit,
  ArrowRight,
  Send,
  CheckCircle,
  TrendingUp,
  Loader2,
  FileText
} from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Separator } from "../ui/separator";
import { api, getImageUrl, EscalationData, CaseData, FindingData } from "../../../api";
import { Textarea } from "../ui/textarea";
import { ScrollArea } from "../ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

export function SpecialistReview() {
  const { setSlots, clearSlots } = useHeader();
  const { patientId } = useParams();
  const [zoom, setZoom] = useState(100);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [specialistNotes, setSpecialistNotes] = useState("");
  const [editedReport, setEditedReport] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [decisionReason, setDecisionReason] = useState("");
  const [historyReports, setHistoryReports] = useState<CaseData[]>([]);
  const [findings, setFindings] = useState<FindingData[]>([]);
  const [imageLayout, setImageLayout] = useState({ naturalW: 500, naturalH: 600, displayW: 500, displayH: 600, offsetX: 0, offsetY: 0 });
  const IMAGE_FRAME_WIDTH = 500;
  const IMAGE_FRAME_HEIGHT = 600;

  // Data fetching state
  const [escalation, setEscalation] = useState<EscalationData | null>(null);
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch escalation and case data
  useEffect(() => {
    const fetchData = async () => {
      if (!patientId) return;

      setLoading(true);
      setError(null);

      try {
        const escalations = await api.getEscalations();
        const matchingEscalation = escalations.find(e => e.patientId === patientId);

        if (matchingEscalation) {
          setEscalation(matchingEscalation);
        } else {
          setError("Escalation not found");
        }

        try {
          const caseResponse = await api.getCase(patientId);
          const findingsData = await api.getFindings(patientId);
          setFindings(findingsData);
          setCaseData(caseResponse);

          const allHistory = await api.getCases(true);
          const active = await api.getCases(false);
          const merged = [...active, ...allHistory].filter((c) => c.patientId === patientId);
          setHistoryReports(merged);
        } catch {
          // Case data not found
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [patientId]);

  useEffect(() => {
    if (!patientId || !escalation) {
      clearSlots();
      return;
    }

    setSlots({
      left: (
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/dashboard/escalations"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors duration-150 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="w-px h-5 bg-slate-200 shrink-0" />
          <div className="flex items-center gap-1.5 text-sm min-w-0 flex-wrap">
            <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
              {escalation.patientId}
            </span>
            <span className="text-slate-700 font-medium truncate max-w-[140px]">{escalation.name}</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500 shrink-0">{escalation.age} / {escalation.sex}</span>
          </div>
        </div>
      ),
      right: (
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-8 text-xs text-green-700 border-green-300 hover:bg-green-50" onClick={handleApprove}>
            <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
            Approve Draft
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={editMode ? handleSaveDraft : handleEditReport}>
            <FileEdit className="h-3.5 w-3.5 mr-1.5" />
            {editMode ? "Save Changes" : "Edit Report"}
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleReturn}>
            <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
            Return to Clinic
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs border-blue-200 text-blue-700 hover:bg-blue-50" onClick={handleDownloadReport}>
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Download Report
          </Button>
          <Button size="sm" className="h-8 text-xs bg-red-700 hover:bg-red-800" onClick={handleRecommendTransfer}>
            <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
            Transfer
          </Button>
        </div>
      )
    });

    return () => clearSlots();
  }, [patientId, escalation, editMode, setSlots, clearSlots]);

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

  const handleApprove = async () => {
    if (!patientId) return;
    if (!decisionReason) {
      /* alert */ console.log("Select a reason code before approving.");
      return;
    }
    try {
      await api.updateEscalation(patientId, {
        status: "finalized",
        specialistNotes: `${decisionReason}${specialistNotes ? ` | ${specialistNotes}` : ""}`,
      });
      /* alert */ console.log("Report approved and finalized");
    } catch (err) {
      /* alert */ console.log("Failed to approve report");
    }
  };

  const handleReturn = async () => {
    if (!patientId) return;
    if (!decisionReason) {
      /* alert */ console.log("Select a reason code before returning case.");
      return;
    }
    try {
      await api.updateEscalation(patientId, {
        status: "returned",
        specialistNotes: `${decisionReason}${specialistNotes ? ` | ${specialistNotes}` : ""}`,
      });
      /* alert */ console.log("Case returned to clinic");
    } catch (err) {
      /* alert */ console.log("Failed to return case");
    }
  };

  const handleEditReport = () => {
    setEditedReport(caseData?.aiDraftReport || "");
    setEditMode(true);
  };

  const handleSaveDraft = async () => {
    if (!patientId) return;
    try {
      await api.updateCase(patientId, { aiDraftReport: editedReport || caseData?.aiDraftReport });
      setCaseData((prev) => prev ? { ...prev, aiDraftReport: editedReport || prev.aiDraftReport } : prev);
      setEditMode(false);
      /* alert */ console.log("Draft saved successfully.");
    } catch {
      /* alert */ console.log("Failed to save draft.");
    }
  };

  const handleFinalizeReturn = async () => {
    if (!patientId) return;
    if (!decisionReason) {
      /* alert */ console.log("Select a reason code before finalising.");
      return;
    }
    try {
      const finalReport = editMode && editedReport ? editedReport : caseData?.aiDraftReport;
      await api.updateCase(patientId, { aiDraftReport: finalReport, aiStatus: "complete" });
      await api.updateEscalation(patientId, {
        status: "returned",
        specialistNotes: `${decisionReason}${specialistNotes ? ` | ${specialistNotes}` : ""}`,
      });
      setEditMode(false);
      /* alert */ console.log("Case finalised and returned to clinic.");
    } catch {
      /* alert */ console.log("Failed to finalise case.");
    }
  };

  const handleRecommendTransfer = async () => {
    if (!patientId) return;
    try {
      await api.updateEscalation(patientId, {
        status: "finalized",
        specialistNotes: `TRANSFER RECOMMENDED${decisionReason ? ` | ${decisionReason}` : ""}${specialistNotes ? ` | ${specialistNotes}` : ""}`,
      });
      await api.updateCase(patientId, { priority: "immediate", triageColor: "red" });
      /* alert */ console.log("Hospital transfer recommended and case escalated.");
    } catch {
      /* alert */ console.log("Failed to recommend transfer.");
    }
  };

  const handleDownloadReport = async () => {
    if (!patientId) return;
    try {
      const data = await api.downloadReport(patientId, `${decisionReason}${specialistNotes ? ` | ${specialistNotes}` : ""}`);
      const blob = new Blob([data.content], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      /* alert */ console.log("Failed to download report.");
    }
  };

  const aiDraftReport = editMode ? editedReport : (caseData?.aiDraftReport || "No AI draft report available for this case.");
  const recommendedSteps = (caseData?.recommendedSteps || "")
    .split(/\n+/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter((line) => line.length > 3)
    .slice(0, 6);
  const previousReport = historyReports
    .filter((r) => r.aiDraftReport && r.timeReceived !== caseData?.timeReceived)
    .sort((a, b) => (b.timeReceived || "").localeCompare(a.timeReceived || ""))[0];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading escalation data...</p>
        </div>
      </div>
    );
  }

  if (error || !escalation) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-600 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error || "Escalation not found"}</p>
          <Link
            to="/dashboard/escalations"
            title="Back to Escalations"
            className="inline-flex items-center justify-center p-2 rounded-lg text-slate-500
                       hover:bg-slate-100 hover:text-slate-900 transition-colors duration-150"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Main Content - 3 Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Patient Context & Escalation Info */}
        <div className="w-80 border-r border-slate-200 bg-white overflow-auto">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-orange-900">Escalation Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-xs text-orange-700 font-medium mb-1">Reason for Escalation</div>
                    <p className="text-sm text-orange-900 leading-relaxed">
                      {escalation.reasonForEscalation}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-orange-200">
                    <span className="text-xs text-orange-700">Priority</span>
                    <Badge className="bg-orange-600 text-white capitalize">{escalation.priority}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-orange-700">Time Waiting</span>
                    <span className="text-sm font-medium text-orange-900">{escalation.timeWaiting}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-orange-700">Referred By</span>
                    <span className="text-sm font-medium text-orange-900">Clinical Team</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Decision Coding (Mandatory)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Select value={decisionReason} onValueChange={setDecisionReason}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select reason code" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="confirm_ai">Confirm AI finding</SelectItem>
                      <SelectItem value="override_false_positive">Override false positive</SelectItem>
                      <SelectItem value="override_false_negative">Override missed pathology</SelectItem>
                      <SelectItem value="insufficient_quality">Insufficient image quality</SelectItem>
                      <SelectItem value="request_additional_tests">Request additional tests</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Demographics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Patient ID:</span>
                    <span className="font-mono">{escalation.patientId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Name:</span>
                    <span className="font-medium">{escalation.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Age / Sex:</span>
                    <span>{escalation.age} years / {escalation.sex === 'M' ? 'Male' : escalation.sex === 'F' ? 'Female' : escalation.sex}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Status:</span>
                    <span className="capitalize">{escalation.status}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Presenting Complaint</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {caseData?.complaint || "Chronic cough for 8 months with progressive dyspnea on exertion. Patient reports intermittent chest pain and occasional hemoptysis. No fever or night sweats reported."}
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
                    <span>{caseData?.vitalTemp ?? "--"}°C</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Heart Rate:</span>
                    <span>{caseData?.vitalHr ?? "--"} bpm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">BP:</span>
                    <span>{caseData?.vitalBp ?? "--"} mmHg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Resp Rate:</span>
                    <span className="font-medium">{caseData?.vitalResp ?? "--"} /min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">SpO2:</span>
                    <span>{caseData?.vitalSpo2 ?? "--"}% (room air)</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Clinical History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="text-slate-700 whitespace-pre-wrap">
                    {caseData?.riskFactors || "No risk-factor history entered yet."}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Study Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Study Type:</span>
                    <span>{caseData?.studyType || "--"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Views:</span>
                    <span>{caseData?.studyType?.includes("PA") ? "PA" : "--"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Date/Time:</span>
                    <span>{caseData?.timeReceived || "--"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Ordering Provider:</span>
                    <span>Primary Clinician</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-blue-50 border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-blue-900">AI Assessment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-700">Triage Level</span>
                    <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300 capitalize">
                      {escalation.aiTriage}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-700">Confidence</span>
                    <span className="text-lg font-semibold text-blue-900">
                      {Math.round((escalation.confidence || 0) * (escalation.confidence <= 1 ? 100 : 1))}%
                    </span>
                  </div>
                  <div className="pt-2 border-t border-blue-200">
                    <p className="text-xs text-blue-800 leading-relaxed">
                      {caseData?.aiDraftReport || "AI analysis context will appear here after model processing."}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Report Version Comparison</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="rounded border border-slate-200 p-2 bg-slate-50">
                    <div className="font-semibold text-slate-700 mb-1">Current Draft</div>
                    <div className="text-slate-600 whitespace-pre-wrap">{(caseData?.aiDraftReport || "No draft").slice(0, 360)}</div>
                  </div>
                  <div className="rounded border border-slate-200 p-2 bg-slate-50">
                    <div className="font-semibold text-slate-700 mb-1">Previous Version</div>
                    <div className="text-slate-600 whitespace-pre-wrap">{(previousReport?.aiDraftReport || "No previous version available").slice(0, 360)}</div>
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
              <div className="w-[500px] h-[600px] bg-slate-800 rounded-lg border-2 border-slate-700 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 opacity-80"></div>
                {caseData?.imagePath ? (
                  <img src={getImageUrl(caseData.imagePath)} className="absolute inset-0 w-full h-full object-contain mix-blend-screen opacity-80 pointer-events-none" alt="Patient Radiograph" onLoad={handleImageLoad} />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center"><div className="w-16 h-16 border-4 border-slate-600 border-t-slate-400 rounded-full animate-spin"></div></div>
                )}

                {showAnnotations && (
  <>
    {findings.filter(f => f.bbox_x1 != null && f.bbox_y1 != null && f.bbox_x2 != null && f.bbox_y2 != null).map((finding, idx) => {
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
                  <div>{escalation.patientId} | {caseData?.studyType || "--"}</div>
                  <div>{caseData?.timeReceived || "--"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - AI Draft & Specialist Actions */}
        <div className="w-96 border-l border-slate-200 bg-white overflow-auto">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {/* AI Draft Report */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">AI Draft Report</CardTitle>
                    <Badge variant="outline" className="bg-slate-100 text-slate-700">
                      Confidence: {Math.round((escalation.confidence || 0) * (escalation.confidence <= 1 ? 100 : 1))}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm space-y-3 text-slate-700 leading-relaxed">
                    <div className="whitespace-pre-wrap">{aiDraftReport}</div>
                  </div>
                </CardContent>
              </Card>

              {/* Clinical Context Alert */}
              <Card className="bg-amber-50 border-amber-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-amber-900 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Clinical Context
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-amber-800 space-y-2">
                  <div>• Complaint: {caseData?.complaint || "Not provided"}</div>
                  <div>• Risk factors: {caseData?.riskFactors || "Not provided"}</div>
                  <div>• Clinical notes: {caseData?.clinicalNotes || "Not provided"}</div>
                  <div className="pt-2 border-t border-amber-300 text-amber-900 font-medium">
                    Key Question: Do findings support immediate intervention or follow-up management?
                  </div>
                </CardContent>
              </Card>

              {/* Specialist Notes */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Specialist Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea 
                    placeholder="Enter your clinical assessment, recommendations, and interpretation..."
                    className="min-h-[120px] text-sm"
                    value={specialistNotes}
                    onChange={(e) => setSpecialistNotes(e.target.value)}
                  />
                </CardContent>
              </Card>

              {/* Recommended Actions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Recommended Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" className="w-full justify-start text-left" onClick={handleApprove}>
                    <CheckCircle className="h-4 w-4 mr-2 shrink-0" />
                    <div className="text-sm">
                      <div className="font-medium">Approve AI Draft Report</div>
                      <div className="text-xs text-slate-500">AI report is accurate, no edits needed</div>
                    </div>
                  </Button>

                  <Button variant="outline" className="w-full justify-start text-left" onClick={handleEditReport}>
                    <FileEdit className="h-4 w-4 mr-2 shrink-0" />
                    <div className="text-sm">
                      <div className="font-medium">{editMode ? "Cancel Edit" : "Edit & Finalize Report"}</div>
                      <div className="text-xs text-slate-500">Modify AI draft with corrections</div>
                    </div>
                  </Button>

                  <Button variant="outline" className="w-full justify-start text-left" onClick={handleReturn}>
                    <ArrowRight className="h-4 w-4 mr-2 shrink-0" />
                    <div className="text-sm">
                      <div className="font-medium">Return to Clinic with Guidance</div>
                      <div className="text-xs text-slate-500">Send back with specialist notes</div>
                    </div>
                  </Button>

                  <Button variant="outline" className="w-full justify-start text-left border-red-300 text-red-700 hover:bg-red-50" onClick={handleRecommendTransfer}>
                    <TrendingUp className="h-4 w-4 mr-2 shrink-0" />
                    <div className="text-sm">
                      <div className="font-medium">Recommend Hospital Transfer</div>
                      <div className="text-xs text-red-600">Requires tertiary care facility</div>
                    </div>
                  </Button>
                </CardContent>
              </Card>

              {/* Recommendations Template */}
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-blue-900">Suggested Management</CardTitle>
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
                    <div className="text-blue-800">No model-generated management recommendations available for this case yet.</div>
                  )}
                </CardContent>
              </Card>

              {/* Finalize Actions */}
              <div className="flex flex-col gap-2 pt-2">
                <Button className="w-full" size="lg" onClick={handleFinalizeReturn}>
                  <Send className="h-4 w-4 mr-2" />
                  Finalize & Return to Clinic
                </Button>
                <Button variant="outline" className="w-full" onClick={handleSaveDraft}>
                  Save Draft
                </Button>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
