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

  async updateCase(patientId: string, data: Partial<CaseData>): Promise<{status: string}> {
    const res = await fetch(`${API_BASE}/cases/${patientId}`, {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to update case");
    return res.json();
  },

  async getEscalations(): Promise<EscalationData[]> {
    const res = await fetch(`${API_BASE}/escalations`);
    if (!res.ok) throw new Error("Failed to fetch escalations");
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
    if (!res.ok) throw new Error("Failed to set AI model");
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
  }
};
