import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Loader2, QrCode, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { api, type AnalyticsSummary, type LanInfo } from "../../../api";
import { toast } from "sonner";
import { Button } from "../ui/button";

const TRIAGE_COLORS: Record<string, string> = {
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  green: "#22c55e",
};

export function Insights() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [lan, setLan] = useState<LanInfo | null>(null);
  const [briefing, setBriefing] = useState<string>("");
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [error, setError] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    Promise.all([api.getAnalyticsSummary(), api.getLanInfo().catch(() => null)])
      .then(([summary, lanInfo]) => {
        if (!mounted.current) return;
        setData(summary);
        setLan(lanInfo);
      })
      .catch(() => mounted.current && setError(true));
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadBriefing = async () => {
    setBriefingLoading(true);
    try {
      const res = await api.getMorningBriefing();
      setBriefing(res.briefing);
    } catch {
      toast.error("Could not generate the briefing. Is the local model running?");
    } finally {
      setBriefingLoading(false);
    }
  };

  const runMaintenance = async () => {
    setMaintenanceLoading(true);
    try {
      await api.runMaintenance();
      toast.success("Maintenance complete: backup, RAG refresh, and model retrain ran.");
    } catch {
      toast.error("Maintenance run failed.");
    } finally {
      setMaintenanceLoading(false);
    }
  };

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        Could not load analytics. Verify the backend is running.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-slate-50 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="w-6 h-6 text-blue-500" />
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Insights &amp; Operations</h2>
          <p className="text-sm text-slate-500">
            On-device analytics across {data.totalCases} cases — no data leaves this machine.
          </p>
        </div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={runMaintenance} disabled={maintenanceLoading}>
          {maintenanceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Run maintenance
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Triage distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-medium text-slate-700 mb-3">Triage Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data.triageDistribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} label>
                {data.triageDistribution.map((entry) => (
                  <Cell key={entry.name} fill={TRIAGE_COLORS[entry.name] || "#94a3b8"} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top findings */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-medium text-slate-700 mb-3">Most Frequent Findings</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.topFindings} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Confidence trend */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-medium text-slate-700 mb-3">AI Confidence Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.confidenceTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="patientId" hide />
              <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="confidence" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* SHAP explainability */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-medium text-slate-700 mb-1">Risk Explainability (SHAP)</h3>
          <p className="text-xs text-slate-500 mb-3">Feature contributions for a high-risk vitals profile.</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.shapExample} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="feature" width={90} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="contribution" radius={[0, 4, 4, 0]}>
                {data.shapExample.map((entry) => (
                  <Cell key={entry.feature} fill={entry.contribution >= 0 ? "#ef4444" : "#22c55e"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Morning briefing agent */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-slate-700 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" /> Morning Briefing Agent
            </h3>
            <Button variant="outline" size="sm" onClick={loadBriefing} disabled={briefingLoading}>
              {briefingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              Generate
            </Button>
          </div>
          {briefing ? (
            <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans">{briefing}</pre>
          ) : (
            <p className="text-sm text-slate-400">
              Generate an AI summary of the worklist with a prioritised review order.
            </p>
          )}
        </div>

        {/* LAN intake QR */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-medium text-slate-700 flex items-center gap-2 mb-3">
            <QrCode className="w-4 h-4 text-blue-500" /> LAN Intake Portal
          </h3>
          {lan?.qrDataUrl ? (
            <div className="text-center">
              <img src={lan.qrDataUrl} alt="LAN upload QR code" className="w-40 h-40 mx-auto" />
              <p className="text-xs text-slate-500 mt-2 break-all">{lan.url}</p>
              <p className="text-xs text-slate-400 mt-2">
                Scan from any phone on this WiFi to upload X-rays or documents.
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">LAN portal unavailable.</p>
          )}
        </div>
      </div>
    </div>
  );
}
