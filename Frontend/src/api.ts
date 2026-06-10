export interface CaseData {
  patientId: string;
  name: string;
  age: number;
  sex: string;
  complaint: string;
  studyType: string;
  timeReceived: string;
  aiStatus: "ready" | "analyzing" | "complete" | "escalated";
  triageColor: "red" | "orange" | "yellow" | "green";
  confidence: number;
  priority?: string;
  imagePath?: string;
  vitalTemp?: number;
  vitalHr?: number;
  vitalBp?: string;
  vitalResp?: number;
  vitalSpo2?: number;
  vitalWeight?: number;
  riskFactors?: string;
  clinicalNotes?: string;
  differentialDiagnosis?: string;
  recommendedSteps?: string;
  aiDraftReport?: string;
  isArchived?: number;
}

export interface SystemStatus {
  status: string;
  active_model?: string;
  uptime: string;
  cpu_usage: number;
  memory_usage: number;
  active_users: number;
  running_processes: {
    name: string;
    status: string;
    cpu: number;
    mem: number;
  }[];
  queue_length: number;
  estimated_wait_time: string;
  recent_errors: number;
  pipeline_stream?: string[];
  model_warm_state?: {
    exp1_detector: boolean;
    exp1_analyzer: boolean;
    exp2_preprocessor: boolean;
  };
  queue_stage_depth?: Record<string, number>;
  retry_count?: number;
  failed_jobs?: number;
}

export interface AnalyzeJobRequest {
  imagePath: string;
  patientId?: string;
  patientContext?: string;
  userAction?: string;
  forceConsensus?: boolean;
}

export interface AnalyzeJobStatus {
  jobId: string;
  status: string;
  progress: number;
  attempts: number;
  maxRetries: number;
  cancelRequested: boolean;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  result?: Record<string, unknown>;
}

export interface InferenceLedgerItem {
  runId: string;
  caseId?: string;
  modelId: string;
  pipelineMode: string;
  imageHash: string;
  topPathology?: string;
  rawConfidence: number;
  calibratedConfidence: number;
  confidenceBucket: string;
  riskBand?: string;
  expectedErrorBin?: string;
  uncertainty: number;
  latencyMs: number;
  userAction: string;
  policyAction?: string;
  consensusState?: string;
  status: string;
  createdAt: string;
}

export interface ObservabilitySnapshot {
  activePipeline: string;
  modelWarmState: {
    exp1Detector: boolean;
    exp1Analyzer: boolean;
    exp2Preprocessor: boolean;
  };
  queueStageDepth: Record<string, number>;
  endpoints: Record<string, { count: number; errors: number; avgMs: number; p95Ms: number; maxMs: number }>;
  recentErrorCount: number;
}

export interface DriftReport {
  recentWindowDays: number;
  recentCount: number;
  baselineCount: number;
  recentCaseMix: Record<string, number>;
  baselineCaseMix: Record<string, number>;
  recentAvgCalibratedConfidence: number;
  baselineAvgCalibratedConfidence: number;
  confidenceDrift: number;
  recentLowQualityRate: number;
  baselineLowQualityRate: number;
}

export interface EscalationTimelineEvent {
  eventType: string;
  oldStatus?: string;
  newStatus?: string;
  reason?: string;
  actor?: string;
  timestamp: string;
}

export interface OfflineQueueItem {
  id: string;
  route: string;
  method: "POST" | "PUT" | "DELETE";
  payload: unknown;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

export interface EscalationData {
  patientId: string;
  name: string;
  age: number;
  sex: string;
  reasonForEscalation: string;
  priority: "routine" | "urgent" | "immediate";
  aiTriage: "red" | "orange" | "yellow";
  confidence: number;
  timeWaiting: string;
  status: "awaiting" | "in-review" | "returned" | "finalized";
  assignedTo?: string;
  specialistNotes?: string;
}

export interface EHRTimelineEntry {
  timestamp: string;
  entryType: string;
  title: string;
  details: string;
  status?: string;
  confidence?: number;
}

export interface DeletePatientHistoryResult {
  patientId: string;
  softDeletedCases: number;
  softDeletedFindings: number;
  softDeletedEscalations: number;
}

export interface RecycleBinItem {
  patientId: string;
  caseCount: number;
  escalationCount: number;
  deletedAt?: string;
}

export interface CaseStats {
  newCases: number;
  urgentCases: number;
  escalatedCases: number;
  completedToday: number;
  totalCases: number;
}

export interface EscalationStats {
  awaiting: number;
  inReview: number;
  returned: number;
  finalized: number;
}

export interface LegacyReanalyzeRequest {
  onlyMissingFindings?: boolean;
  includeArchived?: boolean;
  limit?: number;
  continueOnError?: boolean;
}

export interface LegacyReanalyzeResult {
  totalConsidered: number;
  processed: number;
  analyzed: number;
  bootstrapped: number;
  skippedHasFindings: number;
  skippedMissingImage: number;
  failed: number;
  errors: string[];
}

export interface FindingData {
  case_id: string;
  disease: string;
  confidence: number;
  bbox_x1?: number | null;
  bbox_y1?: number | null;
  bbox_x2?: number | null;
  bbox_y2?: number | null;
  report?: string | null;
  severity?: string | null;
  source_engine?: string | null;
}

/** POST /api/v1/analyze — synchronous full pipeline (Exp1 + Exp2 when mode is `both`). */
export interface AnalyzeXrayRequest {
  imagePath: string;
  patientId?: string;
  patientContext?: string;
  userAction?: string;
  forceConsensus?: boolean;
}

export interface AnalyzeXrayResult {
  engine?: string;
  status?: string;
  findings?: Array<Record<string, unknown>>;
  summary?: string;
  confidence?: number;
  triageColor?: string;
  priority?: string;
  aiDraftReport?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatResponse {
  response: string;
}

const API_HOST = import.meta.env.VITE_API_HOST ?? "http://localhost:8000";
const API_BASE = `${API_HOST}/api/v1`;

export function getImageUrl(imagePath: string | null | undefined): string | undefined {
  if (!imagePath) return undefined;
  if (imagePath.startsWith("http")) return imagePath;
  return `${API_HOST}/${imagePath}`;
}
const OFFLINE_QUEUE_KEY = "hsil_offline_sync_queue";

const readOfflineQueue = (): OfflineQueueItem[] => {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeOfflineQueue = (items: OfflineQueueItem[]) => {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items));
};

const enqueueOfflineMutation = (item: Omit<OfflineQueueItem, "id" | "createdAt" | "retryCount">): OfflineQueueItem => {
  const nextItem: OfflineQueueItem = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };
  const queue = readOfflineQueue();
  queue.push(nextItem);
  writeOfflineQueue(queue);
  return nextItem;
};

// Only connectivity failures should be queued for later sync. Server-side
// rejections (validation, 404s) would replay forever and never succeed.
const isNetworkError = (err: unknown): boolean =>
  err instanceof TypeError || (err instanceof Error && /fetch|network/i.test(err.message));

const MAX_OFFLINE_RETRIES = 5;

export const api = {
  async getCases(history: boolean = false): Promise<CaseData[]> {
    const res = await fetch(`${API_BASE}/cases${history ? '?history=true' : ''}`);
    if (!res.ok) throw new Error("Failed to fetch cases");
    return res.json();
  },

  async getCaseStats(): Promise<CaseStats> {
    const res = await fetch(`${API_BASE}/cases/stats/summary`);
    if (!res.ok) throw new Error("Failed to fetch case stats");
    return res.json();
  },

  async getCase(patientId: string): Promise<CaseData> {
    const res = await fetch(`${API_BASE}/cases/${patientId}`);
    if (!res.ok) throw new Error("Case not found");
    return res.json();
  },

  async getFindings(patientId: string): Promise<FindingData[]> {
    const res = await fetch(`${API_BASE}/findings/${patientId}`);
    if (!res.ok) throw new Error("Failed to fetch findings");
    return res.json();
  },

  async analyzeXray(payload: AnalyzeXrayRequest): Promise<AnalyzeXrayResult> {
    const res = await fetch(`${API_BASE}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imagePath: payload.imagePath,
        patientId: payload.patientId,
        patientContext: payload.patientContext ?? "",
        userAction: payload.userAction ?? "manual_analyze",
        forceConsensus: payload.forceConsensus ?? false,
      }),
    });
    if (!res.ok) {
      let detail = "Analysis failed";
      try {
        const err = await res.json();
        if (err?.detail) detail = String(err.detail);
      } catch {
        /* ignore */
      }
      throw new Error(detail);
    }
    return res.json();
  },

  async updateCase(patientId: string, data: Partial<CaseData>): Promise<{status: string}> {
    try {
      const res = await fetch(`${API_BASE}/cases/${patientId}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to update case");
      return res.json();
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      enqueueOfflineMutation({
        route: `/cases/${patientId}`,
        method: "PUT",
        payload: data,
      });
      return { status: "queued-offline" };
    }
  },

  async getEscalations(status?: EscalationData["status"]): Promise<EscalationData[]> {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
    const res = await fetch(`${API_BASE}/escalations${suffix}`);
    if (!res.ok) throw new Error("Failed to fetch escalations");
    return res.json();
  },

  async createEscalation(data: EscalationData): Promise<EscalationData> {
    try {
      const res = await fetch(`${API_BASE}/escalations`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to create escalation");
      return res.json();
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      enqueueOfflineMutation({
        route: "/escalations",
        method: "POST",
        payload: data,
      });
      return {
        ...data,
        status: data.status || "awaiting",
      };
    }
  },
  
  async getEscalationStats(): Promise<EscalationStats> {
    const res = await fetch(`${API_BASE}/escalations/stats`);
    if (!res.ok) throw new Error("Failed to fetch escalation stats");
    return res.json();
  },

  async updateEscalation(patientId: string, data: Partial<EscalationData>): Promise<{status: string}> {
    const payload: Record<string, unknown> = { ...data };
    // When assignedTo is explicitly undefined/null, tell the backend to clear it
    if ("assignedTo" in data && (data.assignedTo === undefined || data.assignedTo === null)) {
      payload.clearAssignedTo = true;
      delete payload.assignedTo;
    }
    try {
      const res = await fetch(`${API_BASE}/escalations/${patientId}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to update escalation");
      return res.json();
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      enqueueOfflineMutation({
        route: `/escalations/${patientId}`,
        method: "PUT",
        payload,
      });
      return { status: "queued-offline" };
    }
  },

  async getSystemStatus(): Promise<SystemStatus> {
    const res = await fetch(`${API_BASE}/system/status`);
    if (!res.ok) throw new Error("Failed to fetch system status");
    return res.json();
  },

  async reanalyzeLegacy(payload: LegacyReanalyzeRequest = {}): Promise<LegacyReanalyzeResult> {
    const res = await fetch(`${API_BASE}/admin/reanalyze-legacy`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        onlyMissingFindings: payload.onlyMissingFindings ?? true,
        includeArchived: payload.includeArchived ?? true,
        limit: payload.limit,
        continueOnError: payload.continueOnError ?? true,
      }),
    });
    if (!res.ok) throw new Error("Failed to run legacy reanalysis");
    return res.json();
  },

  async getAiModel(): Promise<string> {
    const res = await fetch(`${API_BASE}/system/model`);
    const data = await res.json();
    return data.modelId;
  },

  async downloadReport(patientId: string, specialistNotes?: string): Promise<{content: string, filename: string}> {
    const res = await fetch(`${API_BASE}/cases/${patientId}/download`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ patientId, specialistNotes, includeImages: true })
    });
    if (!res.ok) throw new Error("Failed to generate report");
    return res.json();
  },

  async setAiModel(modelId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/system/model`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ modelId })
    });
    if (!res.ok) {
      let detail = "Failed to set AI model";
      try {
        const data = await res.json();
        if (data?.detail) {
          detail = String(data.detail);
        }
      } catch {
        // Keep generic error when backend does not return JSON
      }
      throw new Error(detail);
    }
  },

  async createCase(data: Partial<CaseData>): Promise<CaseData> {
    const payload = {
      ...data,
      patient_id: data.patientId || `PT-NEW-${Math.floor(Math.random() * 1000)}`,
      name: data.name || "Unknown Patient",
      age: data.age || 0,
      sex: data.sex || "Unknown",
      complaint: data.complaint || "None provided"
    };

    try {
      const res = await fetch(`${API_BASE}/cases`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to create case");
      return res.json();
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      const queued = enqueueOfflineMutation({
        route: "/cases",
        method: "POST",
        payload,
      });
      return {
        patientId: String(payload.patient_id),
        name: String(payload.name),
        age: Number(payload.age),
        sex: String(payload.sex),
        complaint: String(payload.complaint),
        studyType: String(data.studyType || "Chest X-Ray (PA)"),
        timeReceived: new Date().toLocaleTimeString(),
        aiStatus: "ready",
        triageColor: "yellow",
        confidence: 0,
        priority: "queued-offline",
        imagePath: data.imagePath,
        aiDraftReport: `Queued for offline sync (${queued.id})`,
      };
    }
  },

  async uploadFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: formData
    });
    if (!res.ok) throw new Error("Failed to upload file");
    const data = await res.json();
    return data.imagePath;
  },

  async askClinicalCopilot(patientId: string, message: string): Promise<string> {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ patientId, message })
    });
    if (!res.ok) throw new Error("Failed to query AI copilot");
    const data: ChatResponse = await res.json();
    return data.response;
  },

  async getEhrTimeline(patientId: string): Promise<EHRTimelineEntry[]> {
    const res = await fetch(`${API_BASE}/ehr/${patientId}/timeline`);
    if (!res.ok) throw new Error("Failed to fetch EHR timeline");
    return res.json();
  },

  async deletePatientHistory(patientId: string): Promise<DeletePatientHistoryResult> {
    const res = await fetch(`${API_BASE}/ehr/${patientId}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete patient history");
    return res.json();
  },

  async getRecycleBin(): Promise<RecycleBinItem[]> {
    const res = await fetch(`${API_BASE}/admin/recycle-bin`);
    if (!res.ok) throw new Error("Failed to fetch recycle bin");
    return res.json();
  },

  async restorePatientHistory(patientId: string): Promise<DeletePatientHistoryResult> {
    const res = await fetch(`${API_BASE}/admin/recycle-bin/${patientId}/restore`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to restore patient history");
    return res.json();
  },

  async createAnalyzeJob(payload: AnalyzeJobRequest): Promise<AnalyzeJobStatus> {
    const res = await fetch(`${API_BASE}/analyze/jobs`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create analyze job");
    return res.json();
  },

  async getAnalyzeJob(jobId: string): Promise<AnalyzeJobStatus> {
    const res = await fetch(`${API_BASE}/analyze/jobs/${jobId}`);
    if (!res.ok) throw new Error("Failed to fetch analyze job");
    return res.json();
  },

  async listAnalyzeJobs(limit: number = 50): Promise<AnalyzeJobStatus[]> {
    const res = await fetch(`${API_BASE}/analyze/jobs?limit=${encodeURIComponent(String(limit))}`);
    if (!res.ok) throw new Error("Failed to list analyze jobs");
    return res.json();
  },

  async cancelAnalyzeJob(jobId: string): Promise<AnalyzeJobStatus> {
    const res = await fetch(`${API_BASE}/analyze/jobs/${jobId}/cancel`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to cancel analyze job");
    return res.json();
  },

  async getInferenceLedger(caseId?: string, limit: number = 100): Promise<InferenceLedgerItem[]> {
    const params = new URLSearchParams();
    if (caseId) params.set("caseId", caseId);
    params.set("limit", String(limit));
    const res = await fetch(`${API_BASE}/admin/inference-ledger?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch inference ledger");
    return res.json();
  },

  async getObservability(): Promise<ObservabilitySnapshot> {
    const res = await fetch(`${API_BASE}/admin/observability`);
    if (!res.ok) throw new Error("Failed to fetch observability snapshot");
    return res.json();
  },

  async getDriftReport(): Promise<DriftReport> {
    const res = await fetch(`${API_BASE}/admin/drift`);
    if (!res.ok) throw new Error("Failed to fetch drift report");
    return res.json();
  },

  async getPolicyRules(): Promise<Record<string, unknown>> {
    const res = await fetch(`${API_BASE}/policy/rules`);
    if (!res.ok) throw new Error("Failed to fetch policy rules");
    return res.json();
  },

  async updatePolicyRules(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await fetch(`${API_BASE}/policy/rules`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update policy rules");
    return res.json();
  },

  async getEscalationTimeline(patientId: string): Promise<EscalationTimelineEvent[]> {
    const res = await fetch(`${API_BASE}/escalations/${patientId}/timeline`);
    if (!res.ok) throw new Error("Failed to fetch escalation timeline");
    return res.json();
  },

  getOfflineQueue(): OfflineQueueItem[] {
    return readOfflineQueue();
  },

  async replayOfflineQueue(): Promise<{ replayed: number; failed: number; remaining: number }> {
    const queue = readOfflineQueue();
    const remaining: OfflineQueueItem[] = [];
    let replayed = 0;
    let failed = 0;

    for (const item of queue) {
      try {
        const res = await fetch(`${API_BASE}${item.route}`, {
          method: item.method,
          headers: {"Content-Type": "application/json"},
          body: item.method === "DELETE" ? undefined : JSON.stringify(item.payload),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        replayed += 1;
      } catch (err) {
        failed += 1;
        // Drop entries that keep failing so the queue cannot grow forever.
        if (item.retryCount + 1 < MAX_OFFLINE_RETRIES) {
          remaining.push({
            ...item,
            retryCount: item.retryCount + 1,
            lastError: err instanceof Error ? err.message : "unknown",
          });
        }
      }
    }

    writeOfflineQueue(remaining);
    return { replayed, failed, remaining: remaining.length };
  }
};
