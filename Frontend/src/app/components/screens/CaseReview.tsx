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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { ClinicalDecisionSupport } from "../ClinicalDecisionSupport";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ParsedCopilotSection {
  index: number;
  title: string;
  body: string;
  bullets: string[];
}

interface ImageLayoutState {
  naturalW: number;
  naturalH: number;
  displayW: number;
  displayH: number;
  offsetX: number;
  offsetY: number;
  frameW: number;
  frameH: number;
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
  const [activeModel, setActiveModel] = useState("experiment1");
  const [consensusTriggered, setConsensusTriggered] = useState(false);
  const [escalateConfirmOpen, setEscalateConfirmOpen] = useState(false);
  const pendingPatchRef = useRef<Partial<CaseData>>({});
  const saveTimerRef = useRef<number | null>(null);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [exp1ImageLayout, setExp1ImageLayout] = useState<ImageLayoutState>({
    naturalW: IMAGE_FRAME_WIDTH,
    naturalH: IMAGE_FRAME_HEIGHT,
    displayW: IMAGE_FRAME_WIDTH,
    displayH: IMAGE_FRAME_HEIGHT,
    offsetX: 0,
    offsetY: 0,
    frameW: IMAGE_FRAME_WIDTH,
    frameH: IMAGE_FRAME_HEIGHT,
  });
  const [exp2ImageLayout, setExp2ImageLayout] = useState<ImageLayoutState>({
    naturalW: IMAGE_FRAME_WIDTH,
    naturalH: IMAGE_FRAME_HEIGHT,
    displayW: IMAGE_FRAME_WIDTH,
    displayH: IMAGE_FRAME_HEIGHT,
    offsetX: 0,
    offsetY: 0,
    frameW: IMAGE_FRAME_WIDTH,
    frameH: IMAGE_FRAME_HEIGHT,
  });
  const exp1FrameRef = useRef<HTMLDivElement | null>(null);
  const exp2FrameRef = useRef<HTMLDivElement | null>(null);
  const exp1ImageRef = useRef<HTMLImageElement | null>(null);
  const exp2ImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!patientId) return;
    localStorage.setItem("hsil_last_viewed_case", patientId);
    const fetchCase = async () => {
      setLoading(true);
      try {
        const [data, findingsData, modelId] = await Promise.all([
          api.getCase(patientId),
          api.getFindings(patientId),
          api.getAiModel().catch(() => "experiment1"),
        ]);
        setCaseData(data);
        const sorted = [...findingsData].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
        setFindings(sorted);
        setActiveModel((modelId || "experiment1").toLowerCase());
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
    let mounted = true;
    const fetchLedger = async () => {
      try {
        const rows = await api.getInferenceLedger(patientId, 1);
        if (mounted) setLatestLedger(rows[0] || null);
      } catch {
        if (mounted) setLatestLedger(null);
      }
    };
    fetchLedger();
    return () => {
      mounted = false;
    };
    // findings.length (not array identity) so the 10s findings poll does not
    // re-fetch the ledger on every tick.
  }, [patientId, findings.length]);

  useEffect(() => {
    const consensusState = String(latestLedger?.consensusState || "").toLowerCase();
    setConsensusTriggered(Boolean(consensusState && consensusState !== "not_run"));
  }, [latestLedger]);

  useEffect(() => {
    if (!patientId || loading) return;
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Analysis is async server-side, so we poll while it runs. Once the case
    // reaches a terminal state we back off from 10s to 60s instead of polling
    // forever (the case can still flip back to "analyzing" on a consensus
    // re-run, which the slow poll catches and speeds back up). Fetches are
    // skipped while the tab is hidden to avoid background network/CPU.
    const TERMINAL = new Set(["complete", "escalated"]);
    const delayFor = (status?: string) => (status && TERMINAL.has(status) ? 60_000 : 10_000);

    const refreshFindings = async () => {
      setFindingsLoading(true);
      let status: string | undefined;
      try {
        const [data, serverCase] = await Promise.all([
          api.getFindings(patientId),
          api.getCase(patientId),
        ]);
        if (!mounted) return;
        status = serverCase.aiStatus;
        const sorted = [...data].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
        setFindings(sorted);
        setCaseData((prev) => {
          if (!prev) return serverCase;
          const merged: CaseData = { ...prev, ...serverCase };
          // Unsaved local edits win over the server snapshot.
          for (const key of Object.keys(pendingPatchRef.current) as Array<keyof CaseData>) {
            (merged as unknown as Record<string, unknown>)[key] = prev[key];
          }
          return merged;
        });
      } catch {
        // Keep the last known findings on transient fetch errors.
      } finally {
        if (mounted) setFindingsLoading(false);
      }
      schedule(status);
    };

    const schedule = (status?: string) => {
      if (!mounted) return;
      timer = setTimeout(() => {
        if (document.hidden) {
          schedule(status); // tab hidden: re-arm without hitting the network
          return;
        }
        refreshFindings();
      }, delayFor(status));
    };

    refreshFindings();
    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [patientId, loading]);

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

  const cleanCopilotText = (value: string): string => {
    return value.replace(/\*\*/g, "").replace(/^[:\-\s]+/, "").trim();
  };

  const parseCopilotSections = (content: string): ParsedCopilotSection[] => {
    const lines = content.replace(/\r\n/g, "\n").split("\n");
    const sections: Array<ParsedCopilotSection & { bodyLines: string[] }> = [];
    let current: (ParsedCopilotSection & { bodyLines: string[] }) | null = null;

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      const sectionMatch = line.match(/^\s*(\d+)[.)]\s*(?:\*\*)?([^:*]+?)(?:\*\*)?\s*:\s*(.*)$/);

      if (sectionMatch) {
        if (current) {
          current.body = cleanCopilotText(current.bodyLines.join(" "));
          sections.push(current);
        }

        current = {
          index: Number(sectionMatch[1]),
          title: cleanCopilotText(sectionMatch[2]),
          body: "",
          bullets: [],
          bodyLines: [],
        };

        const inlineBody = cleanCopilotText(sectionMatch[3] || "");
        if (inlineBody) current.bodyLines.push(inlineBody);
        continue;
      }

      if (!current) continue;

      const bulletMatch = line.match(/^\s*[*\-]\s+(.*)$/);
      if (bulletMatch) {
        const bullet = cleanCopilotText(bulletMatch[1]);
        if (bullet) current.bullets.push(bullet);
        continue;
      }

      if (line.trim()) {
        current.bodyLines.push(cleanCopilotText(line));
      }
    }

    if (current) {
      current.body = cleanCopilotText(current.bodyLines.join(" "));
      sections.push(current);
    }

    return sections
      .sort((a, b) => a.index - b.index)
      .map(({ bodyLines, ...section }) => section);
  };

  const recommendedSteps = parseRecommendedSteps(caseData?.recommendedSteps);

  const renderAssistantMessage = (content: string) => {
    const sections = parseCopilotSections(content);
    if (sections.length < 2) {
      return <div className="whitespace-pre-wrap leading-relaxed">{content}</div>;
    }

    return (
      <div className="space-y-2.5">
        {sections.map((section) => (
          <div key={`${section.index}-${section.title}`} className="rounded-md border border-blue-100 bg-white/70 p-2.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] font-semibold text-blue-700">
                {section.index}
              </span>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{section.title}</p>
            </div>

            {section.body && <p className="mt-1.5 text-sm text-slate-800 leading-relaxed">{section.body}</p>}

            {section.bullets.length > 0 && (
              <ul className="mt-1.5 space-y-1 list-disc pl-5 text-sm text-slate-800">
                {section.bullets.map((bullet, bulletIndex) => (
                  <li key={`${section.index}-bullet-${bulletIndex}`}>{bullet}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    );
  };

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

  const updateLayoutForFrame = (
    img: HTMLImageElement | null,
    frame: HTMLDivElement | null,
    setter: React.Dispatch<React.SetStateAction<ImageLayoutState>>,
  ) => {
    if (!img || !frame) return;

    const frameW = Math.max(1, frame.clientWidth || IMAGE_FRAME_WIDTH);
    const frameH = Math.max(1, frame.clientHeight || IMAGE_FRAME_HEIGHT);
    const naturalW = img.naturalWidth || IMAGE_FRAME_WIDTH;
    const naturalH = img.naturalHeight || IMAGE_FRAME_HEIGHT;
    const scale = Math.min(frameW / naturalW, frameH / naturalH);
    const displayW = naturalW * scale;
    const displayH = naturalH * scale;
    const offsetX = (frameW - displayW) / 2;
    const offsetY = (frameH - displayH) / 2;

    setter({ naturalW, naturalH, displayW, displayH, offsetX, offsetY, frameW, frameH });
  };

  const handleExp1ImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    exp1ImageRef.current = img;
    updateLayoutForFrame(img, exp1FrameRef.current, setExp1ImageLayout);
  };

  const handleExp2ImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    exp2ImageRef.current = img;
    updateLayoutForFrame(img, exp2FrameRef.current, setExp2ImageLayout);
  };

  useEffect(() => {
    const recalcLayouts = () => {
      updateLayoutForFrame(exp1ImageRef.current, exp1FrameRef.current, setExp1ImageLayout);
      updateLayoutForFrame(exp2ImageRef.current, exp2FrameRef.current, setExp2ImageLayout);
    };

    recalcLayouts();
    window.addEventListener("resize", recalcLayouts);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(recalcLayouts);
      if (exp1FrameRef.current) resizeObserver.observe(exp1FrameRef.current);
      if (exp2FrameRef.current) resizeObserver.observe(exp2FrameRef.current);
    }

    return () => {
      window.removeEventListener("resize", recalcLayouts);
      resizeObserver?.disconnect();
    };
  }, []);

  const annotationFindings = findings.filter(
    (f) =>
      f.bbox_x1 != null &&
      f.bbox_y1 != null &&
      f.bbox_x2 != null &&
      f.bbox_y2 != null
  );
  const exp1Annotations = annotationFindings.filter(f => f.source_engine !== "experiment2");
  const exp2Annotations = annotationFindings.filter(f => f.source_engine === "experiment2");
  const showDualOutput = activeModel === "both" || consensusTriggered;

  const getReportForEngine = (engineId: "experiment1" | "experiment2") => {
    return findings
      .find((f) => f.source_engine === engineId && typeof f.report === "string" && f.report.trim().length > 0)
      ?.report
      ?.trim();
  };

  const exp1Report = getReportForEngine("experiment1");
  const exp2Report = getReportForEngine("experiment2");
  const singleReport = caseData?.aiDraftReport || exp1Report || "AI Draft Report has not been generated for this case.";

  const getOverlayStyle = (finding: FindingData, layout: ImageLayoutState) => {
    const x1 = finding.bbox_x1 as number;
    const y1 = finding.bbox_y1 as number;
    const x2 = finding.bbox_x2 as number;
    const y2 = finding.bbox_y2 as number;

    const rawLeft = layout.offsetX + (x1 / layout.naturalW) * layout.displayW;
    const rawTop = layout.offsetY + (y1 / layout.naturalH) * layout.displayH;
    const rawWidth = Math.max(12, ((x2 - x1) / layout.naturalW) * layout.displayW);
    const rawHeight = Math.max(12, ((y2 - y1) / layout.naturalH) * layout.displayH);

    const left = Math.max(0, Math.min(layout.frameW - 12, rawLeft));
    const top = Math.max(0, Math.min(layout.frameH - 12, rawTop));
    const width = Math.max(12, Math.min(layout.frameW - left, rawWidth));
    const height = Math.max(12, Math.min(layout.frameH - top, rawHeight));

    return { left, top, width, height };
  };


  const handleIsolate = async () => {
    if (!caseData) return;
    setActionLoading(true);
    try {
      await api.updateCase(caseData.patientId, { triageColor: "red", priority: "urgent" });
      setCaseData((prev) => (prev ? { ...prev, triageColor: "red", priority: "urgent" } : prev));
      toast.success(`Case ${caseData.patientId} marked for isolation.`);
    } catch {
      toast.error("Failed to update isolation status.");
    } finally {
      setActionLoading(false);
    }
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

  const consensusAbortRef = useRef(false);
  useEffect(() => {
    consensusAbortRef.current = false;
    return () => {
      consensusAbortRef.current = true;
    };
  }, []);

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
        if (consensusAbortRef.current) return;
        if (["completed", "failed", "cancelled"].includes(final.status)) break;
        await new Promise((resolve) => setTimeout(resolve, 1500));
        final = await api.getAnalyzeJob(job.jobId);
      }
      if (consensusAbortRef.current) return;

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
        setConsensusTriggered(true);
      } else if (final.status === "failed") {
        toast.error(final.errorMessage || "Consensus job failed.");
      } else {
        toast.warning("Consensus job did not finish in time. Check System Status for job progress.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to run consensus");
    } finally {
      if (!consensusAbortRef.current) setActionLoading(false);
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
            onClick={() => setEscalateConfirmOpen(true)}
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
            className="h-8 text-xs px-3"
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
      {/* Escalation requires explicit confirmation: it mutates triage state
          and hands the case to the specialist queue. */}
      <AlertDialog open={escalateConfirmOpen} onOpenChange={setEscalateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Escalate to specialist queue?</AlertDialogTitle>
            <AlertDialogDescription>
              Case {caseData.patientId} ({caseData.name}) will be marked as immediate priority
              and sent to the specialist review queue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setEscalateConfirmOpen(false);
                handleEscalate();
              }}
            >
              Escalate Case
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

              {/* ── AI DECISION SUPPORT (risk + agents) ── */}
              <ClinicalDecisionSupport caseData={caseData} />

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
        <div className="flex-1 min-w-0 flex flex-col bg-slate-900 relative overflow-hidden">
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
          <div className="flex-1 flex items-center justify-center p-4 xl:p-6 overflow-auto">
            <div
              className="relative flex w-full max-w-full items-center justify-center gap-6 flex-col 2xl:flex-row"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
            >
              
              {/* Image 1 - Exp 1 */}
              <div className="flex w-full max-w-[520px] flex-col items-center gap-2 shrink-0">
                {showDualOutput && <h3 className="text-slate-300 font-medium text-sm">Experiment 1 (Detector & Analyzer)</h3>}
                <div
                  ref={exp1FrameRef}
                  className="w-full max-w-[500px] aspect-[5/6] min-h-[360px] bg-slate-800 rounded-lg border-2 border-slate-700 relative overflow-hidden shadow-2xl"
                >
                  {/* Simulated X-ray gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 opacity-80"></div>
                  
                  {caseData?.imagePath ? (
                    <img 
                      src={getImageUrl(caseData.imagePath)} 
                      className="absolute inset-0 w-full h-full object-contain mix-blend-screen opacity-80 pointer-events-none" 
                      alt="Patient Radiograph" 
                      onLoad={handleExp1ImageLoad}
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
                      <FileText className="w-10 h-10" />
                      <p className="text-sm">No radiograph available</p>
                    </div>
                  )}

                  {showAnnotations && (
                    <>
                      {(showDualOutput ? exp1Annotations : annotationFindings).map((finding, idx) => {
                        const overlayStyle = getOverlayStyle(finding, exp1ImageLayout);
                        const isPrimary = idx === 0;
                        const boxClass = isPrimary ? "border-red-500" : "border-orange-400";
                        const labelClass = isPrimary ? "bg-red-500" : "bg-orange-500";
                        const hoverClass = isPrimary ? "hover:bg-red-500/10" : "hover:bg-orange-500/10";
                        return (
                          <div
                            key={`ann1-${idx}-${finding.disease}`}
                            className={`absolute border-2 ${boxClass} rounded-md shadow-lg transition-colors ${hoverClass}`}
                            style={overlayStyle}
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
              {showDualOutput && (
                <div className="flex w-full max-w-[520px] flex-col items-center gap-2 shrink-0">
                  <h3 className="text-slate-300 font-medium text-sm">Experiment 2 (Foveal & Reasoner)</h3>
                  <div
                    ref={exp2FrameRef}
                    className="w-full max-w-[500px] aspect-[5/6] min-h-[360px] bg-slate-800 rounded-lg border-2 border-slate-700 relative overflow-hidden shadow-2xl"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 opacity-80"></div>
                    
                    {caseData?.imagePath ? (
                      <img 
                        src={getImageUrl(caseData.imagePath)} 
                        className="absolute inset-0 w-full h-full object-contain mix-blend-screen opacity-80 pointer-events-none" 
                        alt="Patient Radiograph" 
                        onLoad={handleExp2ImageLoad}
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
                      <FileText className="w-10 h-10" />
                      <p className="text-sm">No radiograph available</p>
                    </div>
                    )}

                    {showAnnotations && (
                      <>
                        {exp2Annotations.map((finding, idx) => {
                          const overlayStyle = getOverlayStyle(finding, exp2ImageLayout);
                          const isPrimary = idx === 0;
                          const boxClass = isPrimary ? "border-red-500" : "border-orange-400";
                          const labelClass = isPrimary ? "bg-red-500" : "bg-orange-500";
                          const hoverClass = isPrimary ? "hover:bg-red-500/10" : "hover:bg-orange-500/10";
                          return (
                            <div
                              key={`ann2-${idx}-${finding.disease}`}
                              className={`absolute border-2 ${boxClass} rounded-md shadow-lg transition-colors ${hoverClass}`}
                              style={overlayStyle}
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
        <div className="w-[24rem] min-w-[22rem] max-w-[26rem] border-l border-slate-200 bg-white overflow-auto">
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
                <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Report Preview</p>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {showDualOutput ? "dual" : "single"} model view
                  </Badge>
                </div>
                <div className="px-3.5 py-3">
                  {showDualOutput ? (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                      <div className="rounded-md border border-slate-200 bg-slate-50/70 p-2.5 min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 mb-1.5">Experiment 1</p>
                        <p className="text-sm text-slate-800 whitespace-pre-wrap break-words leading-relaxed">
                          {exp1Report || singleReport}
                        </p>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-slate-50/70 p-2.5 min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 mb-1.5">Experiment 2</p>
                        <p className="text-sm text-slate-800 whitespace-pre-wrap break-words leading-relaxed">
                          {exp2Report || "Second model report is not available yet for this case. Trigger consensus or re-run in dual-model mode to populate."}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-800 whitespace-pre-wrap break-words leading-relaxed">
                      {singleReport}
                    </p>
                  )}
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
                        {msg.role === "assistant" ? renderAssistantMessage(msg.content) : (
                          <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                        )}
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