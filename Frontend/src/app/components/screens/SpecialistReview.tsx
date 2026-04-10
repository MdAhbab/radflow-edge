import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
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
  Loader2
} from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Separator } from "../ui/separator";
import { api, EscalationData, CaseData } from "../../../api";
import { Textarea } from "../ui/textarea";
import { ScrollArea } from "../ui/scroll-area";

export function SpecialistReview() {
  const { patientId } = useParams();
  const [zoom, setZoom] = useState(100);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [specialistNotes, setSpecialistNotes] = useState("");
  const [editedReport, setEditedReport] = useState("");
  const [editMode, setEditMode] = useState(false);

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
          setCaseData(caseResponse);
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

  const handleApprove = async () => {
    if (!patientId) return;
    try {
      await api.updateEscalation(patientId, { status: "finalized", specialistNotes: specialistNotes || undefined });
      alert("Report approved and finalized");
    } catch (err) {
      alert("Failed to approve report");
    }
  };

  const handleReturn = async () => {
    if (!patientId) return;
    try {
      await api.updateEscalation(patientId, { status: "returned", specialistNotes: specialistNotes || undefined });
      alert("Case returned to clinic");
    } catch (err) {
      alert("Failed to return case");
    }
  };

  const aiDraftReport = caseData?.aiDraftReport || "No AI draft report available for this case.";
  const recommendedSteps = (caseData?.recommendedSteps || "")
    .split(/\n+/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter((line) => line.length > 3)
    .slice(0, 6);

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
          <Link to="/dashboard/escalations">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Escalations
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard/escalations">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Escalations
              </Button>
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Specialist Review: {escalation.patientId}</h2>
              <p className="text-sm text-slate-600">{escalation.name} - {escalation.age} / {escalation.sex}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="text-green-700 border-green-300 hover:bg-green-50" onClick={handleApprove}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve Draft
            </Button>
            <Button variant="outline">
              <FileEdit className="h-4 w-4 mr-2" />
              Edit Report
            </Button>
            <Button variant="outline" onClick={handleReturn}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Return to Clinic
            </Button>
            <Button className="bg-red-700 hover:bg-red-800">
              <TrendingUp className="h-4 w-4 mr-2" />
              Recommend Transfer
            </Button>
          </div>
        </div>
      </div>

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
                  <img
                    src={caseData.imagePath.startsWith("http") ? caseData.imagePath : `http://localhost:8000/${caseData.imagePath}`}
                    className="absolute inset-0 w-full h-full object-contain mix-blend-screen opacity-80"
                    alt="Radiograph"
                  />
                ) : (
                  <svg viewBox="0 0 500 600" className="absolute inset-0 w-full h-full opacity-40">
                    <ellipse cx="180" cy="300" rx="120" ry="200" fill="#666" />
                    <ellipse cx="320" cy="300" rx="120" ry="200" fill="#666" />
                    <rect x="240" y="50" width="20" height="150" fill="#555" />
                  </svg>
                )}

                {showAnnotations && (
                  <>
                    {/* AI Annotation - Bilateral upper lobe nodules */}
                    <div className="absolute top-20 right-24 w-40 h-32 border-2 border-orange-400 rounded-lg">
                      <div className="absolute -top-8 left-0 bg-orange-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                        Upper lobe nodular opacities
                      </div>
                    </div>
                    <div className="absolute top-20 left-20 w-36 h-28 border-2 border-orange-400 rounded-lg">
                    </div>

                    {/* AI Annotation - Possible PMF */}
                    <div className="absolute top-32 right-28 w-20 h-24 border-2 border-yellow-400 rounded-lg">
                      <div className="absolute -bottom-8 -right-8 bg-yellow-500 text-slate-900 text-xs px-2 py-1 rounded whitespace-nowrap">
                        ? PMF
                      </div>
                    </div>
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
                  <Button variant="outline" className="w-full justify-start text-left">
                    <CheckCircle className="h-4 w-4 mr-2 shrink-0" />
                    <div className="text-sm">
                      <div className="font-medium">Approve AI Draft Report</div>
                      <div className="text-xs text-slate-500">AI report is accurate, no edits needed</div>
                    </div>
                  </Button>

                  <Button variant="outline" className="w-full justify-start text-left">
                    <FileEdit className="h-4 w-4 mr-2 shrink-0" />
                    <div className="text-sm">
                      <div className="font-medium">Edit & Finalize Report</div>
                      <div className="text-xs text-slate-500">Modify AI draft with corrections</div>
                    </div>
                  </Button>

                  <Button variant="outline" className="w-full justify-start text-left">
                    <ArrowRight className="h-4 w-4 mr-2 shrink-0" />
                    <div className="text-sm">
                      <div className="font-medium">Return to Clinic with Guidance</div>
                      <div className="text-xs text-slate-500">Send back with specialist notes</div>
                    </div>
                  </Button>

                  <Button variant="outline" className="w-full justify-start text-left border-red-300 text-red-700 hover:bg-red-50">
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
                <Button className="w-full" size="lg">
                  <Send className="h-4 w-4 mr-2" />
                  Finalize & Return to Clinic
                </Button>
                <Button variant="outline" className="w-full">
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
