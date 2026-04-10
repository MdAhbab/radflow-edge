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
}

export interface ChatResponse {
  response: string;
}

const API_BASE = "http://localhost:8000/api/v1";

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

  async updateCase(patientId: string, data: Partial<CaseData>): Promise<{status: string}> {
    const res = await fetch(`${API_BASE}/cases/${patientId}`, {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to update case");
    return res.json();
  },

  async getEscalations(status?: EscalationData["status"]): Promise<EscalationData[]> {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
    const res = await fetch(`${API_BASE}/escalations${suffix}`);
    if (!res.ok) throw new Error("Failed to fetch escalations");
    return res.json();
  },

  async createEscalation(data: EscalationData): Promise<EscalationData> {
    const res = await fetch(`${API_BASE}/escalations`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to create escalation");
    return res.json();
  },
  
  async getEscalationStats(): Promise<EscalationStats> {
    const res = await fetch(`${API_BASE}/escalations/stats`);
    if (!res.ok) throw new Error("Failed to fetch escalation stats");
    return res.json();
  },

  async updateEscalation(patientId: string, data: Partial<EscalationData>): Promise<{status: string}> {
    const res = await fetch(`${API_BASE}/escalations/${patientId}`, {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to update escalation");
    return res.json();
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
    const res = await fetch(`${API_BASE}/cases`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        ...data,
        patient_id: data.patientId || `PT-NEW-${Math.floor(Math.random() * 1000)}`,
        name: data.name || "Unknown Patient",
        age: data.age || 0,
        sex: data.sex || "Unknown",
        complaint: data.complaint || "None provided"
      })
    });
    if (!res.ok) throw new Error("Failed to create case");
    return res.json();
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
  }
};
