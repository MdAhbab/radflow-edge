import { useState, useEffect } from "react";
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
import { api, CaseData } from "../../../api";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function CaseReview() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatExpanded, setChatExpanded] = useState(true);
  const [genexpertOrdered, setGenexpertOrdered] = useState(false);

  useEffect(() => {
    if (!patientId) return;
    const fetchCase = async () => {
      setLoading(true);
      try {
        const data = await api.getCase(patientId);
        setCaseData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load case");
      } finally {
        setLoading(false);
      }
    };
    fetchCase();
  }, [patientId]);

  const handlePromptChip = (prompt: string) => {
    setChatMessages([...chatMessages, { role: "user", content: prompt }]);
    
    // Simulate AI response
    setTimeout(() => {
      let response = "";
      if (prompt.includes("main finding")) {
        response = "The main finding is a **cavitary lesion in the right upper lobe** measuring approximately 3.2 cm in diameter with irregular thick walls. This is surrounded by bilateral upper lobe nodular and reticulonodular opacities, more prominent on the right side. These findings are highly suspicious for active pulmonary tuberculosis.";
      } else if (prompt.includes("abnormal region")) {
        response = "I've highlighted the key abnormal regions on the X-ray. The red overlay indicates the cavitary lesion in the right upper lobe. The orange areas show the surrounding nodular opacities and infiltrates. These regions show increased opacity compared to normal lung tissue.";
      } else if (prompt.includes("TB")) {
        response = "Yes, the imaging findings are **highly suspicious for active pulmonary tuberculosis**. Key indicators include:\n\n• Cavitary lesion with thick irregular walls (classic for TB)\n• Upper lobe predominance (typical TB distribution)\n• Bilateral nodular opacities\n• Patient's symptoms (persistent cough, night sweats, weight loss)\n\nHowever, the confidence is 87% rather than higher because silicosis can present similarly. The patient's occupational history is not noted, but differential diagnosis includes chronic silicosis with superimposed TB.";
      } else if (prompt.includes("should I do")) {
        response = "**Immediate Actions Recommended:**\n\n1. **Isolate patient** - Implement airborne precautions immediately\n2. **Order GeneXpert MTB/RIF** - Rapid molecular testing for TB confirmation\n3. **Collect 3 sputum samples** - For smear microscopy and culture\n4. **Start contact tracing** - Identify household and close contacts\n5. **Consider HIV testing** - If status unknown\n\n**Clinical Assessment:**\n• Assess respiratory status and oxygen saturation\n• Check for signs of severe disease\n• Review previous TB treatment history\n\nGiven the high suspicion, do not delay isolation or diagnostic workup.";
      } else if (prompt.includes("low confidence")) {
        response = "The confidence is 87%, which is actually quite high, but not at the maximum level because:\n\n1. **Differential diagnosis exists**: Silicosis with cavitation can appear very similar to TB\n2. **Limited clinical context**: The AI doesn't have full occupational history or previous imaging\n3. **Some atypical features**: The cavity size and wall thickness could also suggest fungal infection or necrotizing pneumonia\n\nHowever, given the clinical presentation (persistent cough, night sweats, weight loss for 3 months), the probability of active TB is very high. The recommendation to proceed with TB workup remains strong.";
      }
      
      setChatMessages(prev => [...prev, { role: "assistant", content: response }]);
    }, 800);
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    
    setChatMessages([...chatMessages, { role: "user", content: chatInput }]);
    setChatInput("");
    
    // Simulate AI response
    setTimeout(() => {
      setChatMessages(prev => [...prev, { 
        role: "assistant", 
        content: "I can help you understand this case better. Could you clarify what specific aspect you'd like me to explain?" 
      }]);
    }, 800);
  };

  const handleIsolate = async () => {
    if (!caseData) return;
    setActionLoading(true);
    await api.updateCase(caseData.patientId, { triageColor: "red", priority: "urgent" });
    const updated = await api.getCase(caseData.patientId);
    setCaseData(updated);
    setActionLoading(false);
  };

  const handleEscalate = async () => {
    if (!caseData) return;
    setActionLoading(true);
    await api.updateCase(caseData.patientId, { aiStatus: "escalated" });
    navigate("/dashboard");
  };

  const handleSaveToEHR = async () => {
    if (!caseData) return;
    setActionLoading(true);
    await api.updateCase(caseData.patientId, { aiStatus: "complete", isArchived: 1 });
    navigate("/history");
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
                    <span className={`font-medium ${caseData.vitalTemp && caseData.vitalTemp > 37.5 ? 'text-orange-700' : ''}`}>
                      {caseData.vitalTemp || '--'}°C
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Heart Rate:</span>
                    <span>{caseData.vitalHr || '--'} bpm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">BP:</span>
                    <span>{caseData.vitalBp || '--'} mmHg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Resp Rate:</span>
                    <span className="font-medium">{caseData.vitalResp || '--'} /min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">SpO2:</span>
                    <span className="font-medium text-orange-700">{caseData.vitalSpo2 || '--'}% (room air)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Weight:</span>
                    <span>{caseData.vitalWeight || '--'} kg</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Risk Factors & History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="pt-2 text-slate-600">
                    {caseData.riskFactors || 'No significant risk factors available.'}
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
                    <span>{caseData.studyType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Date/Time:</span>
                    <span>{caseData.timeReceived}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-amber-50 border-amber-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-amber-900">Clinical Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-amber-800 leading-relaxed">
                    {caseData.clinicalNotes || 'No specific clinical notes accompanying this study.'}
                  </p>
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
                    src={caseData.imagePath.startsWith("http") ? caseData.imagePath : `http://localhost:8000/${caseData.imagePath}`} 
                    className="absolute inset-0 w-full h-full object-contain mix-blend-screen opacity-80 pointer-events-none" 
                    alt="Patient Radiograph" 
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
                    {/* AI Annotation - Cavitary lesion */}
                    <div className="absolute top-24 right-32 w-24 h-24 border-4 border-red-500 rounded-full animate-pulse">
                      <div className="absolute -top-8 -right-16 bg-red-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                        Cavitary lesion
                      </div>
                    </div>

                    {/* AI Annotation - Infiltrates */}
                    <div className="absolute top-32 right-24 w-32 h-20 border-2 border-orange-400 rounded-lg opacity-50">
                    </div>
                    <div className="absolute top-32 left-28 w-28 h-16 border-2 border-orange-400 rounded-lg opacity-50">
                    </div>
                  </>
                )}

                {/* Image metadata overlay */}
                <div className="absolute bottom-2 left-2 text-xs text-slate-400 font-mono">
                  <div>PT-2024-0347 | CXR PA</div>
                  <div>2026-04-06 08:15</div>
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
              {caseData.aiStatus === "complete" ? (
                <Card className="border-red-300 bg-red-50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-semibold text-red-900">High Priority</CardTitle>
                      <Badge variant="destructive" className="text-sm">
                        TB Suspected
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-red-800 leading-relaxed">
                      Imaging findings highly suspicious for active pulmonary tuberculosis. 
                      Immediate isolation and diagnostic workup recommended.
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
                  {caseData.aiStatus === "complete" ? (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500" 
                              style={{ width: `${Math.round((caseData.confidence || 0) * (caseData.confidence <= 1 ? 100 : 1))}%` }}
                            ></div>
                          </div>
                        </div>
                        <span className="text-2xl font-semibold text-green-700">
                          {Math.round((caseData.confidence || 0) * (caseData.confidence <= 1 ? 100 : 1))}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-2">
                        High confidence in findings. Differential diagnosis considered.
                      </p>
                    </>
                  ) : (
                    <div className="py-4 text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-500 italic">AI Analysis in Progress...</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Key Findings */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Key Findings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-2">
                    <Badge variant="destructive" className="shrink-0 mt-0.5">1</Badge>
                    <div className="text-sm">
                      <div className="font-medium text-slate-900">Cavitary lesion - right upper lobe</div>
                      <div className="text-slate-600 text-xs mt-0.5">
                        3.2 cm diameter with thick irregular walls
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0 mt-0.5 bg-orange-50 text-orange-700 border-orange-300">2</Badge>
                    <div className="text-sm">
                      <div className="font-medium text-slate-900">Bilateral upper lobe opacities</div>
                      <div className="text-slate-600 text-xs mt-0.5">
                        Nodular and reticulonodular pattern, right &gt; left
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0 mt-0.5 bg-orange-50 text-orange-700 border-orange-300">3</Badge>
                    <div className="text-sm">
                      <div className="font-medium text-slate-900">Infiltrates and consolidation</div>
                      <div className="text-slate-600 text-xs mt-0.5">
                        Surrounding the cavitary lesion
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0 mt-0.5">4</Badge>
                    <div className="text-sm">
                      <div className="font-medium text-slate-900">Volume loss</div>
                      <div className="text-slate-600 text-xs mt-0.5">
                        Mild right upper lobe volume reduction
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Differential Diagnosis */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Differential Diagnosis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">Active pulmonary TB</span>
                    <Badge className="bg-red-100 text-red-800 border-red-300">Primary</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-700">Chronic silicosis + TB</span>
                    <Badge variant="outline">Consider</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-700">Necrotizing pneumonia</span>
                    <Badge variant="outline">Less likely</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-700">Fungal infection</span>
                    <Badge variant="outline">Less likely</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Recommended Actions */}
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-blue-900">Recommended Next Steps</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-blue-800">
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 font-semibold">1.</span>
                    <span>Implement airborne isolation precautions immediately</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 font-semibold">2.</span>
                    <span>Order GeneXpert MTB/RIF test (rapid molecular testing)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 font-semibold">3.</span>
                    <span>Collect 3 sputum samples for smear microscopy and culture</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 font-semibold">4.</span>
                    <span>Initiate contact tracing for household members</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 font-semibold">5.</span>
                    <span>Consider HIV testing if status unknown</span>
                  </div>
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

            {/* Chat Input */}
            <div className="flex gap-2">
              <Input 
                placeholder="Ask a question about this case..." 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                className="flex-1"
              />
              <Button size="icon" variant="outline">
                <Mic className="h-4 w-4" />
              </Button>
              <Button onClick={handleSendMessage}>
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