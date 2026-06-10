import { useState, useEffect } from "react";
import { 
  Server, 
  Activity, 
  Users, 
  Cpu, 
  MemoryStick, 
  Clock, 
  AlertTriangle,
  Play,
  Shield,
  Loader2,
  BarChart3,
  RefreshCcw,
  ListChecks,
  AlertCircle
} from "lucide-react";
import {
  api,
  SystemStatus as SystemStatusType,
  AnalyzeJobStatus,
  ObservabilitySnapshot,
  DriftReport,
  OfflineQueueItem,
  RecycleBinItem,
} from "../../../api";
import { toast } from "sonner";
import { Button } from "../ui/button";

export function SystemStatus() {
  const [status, setStatus] = useState<SystemStatusType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [jobs, setJobs] = useState<AnalyzeJobStatus[]>([]);
  const [observability, setObservability] = useState<ObservabilitySnapshot | null>(null);
  const [driftReport, setDriftReport] = useState<DriftReport | null>(null);
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>([]);
  const [replayingQueue, setReplayingQueue] = useState(false);
  const [recycleItems, setRecycleItems] = useState<RecycleBinItem[]>([]);

  useEffect(() => {
    const fetchStatus = async () => {
      setLoading(true);
      try {
        const [data, obs, drift, recentJobs, recycle] = await Promise.all([
          api.getSystemStatus(),
          api.getObservability(),
          api.getDriftReport(),
          api.listAnalyzeJobs(15),
          api.getRecycleBin(),
        ]);
        setStatus(data);
        setObservability(obs);
        setDriftReport(drift);
        setJobs(recentJobs);
        setRecycleItems(recycle);
        setOfflineQueue(api.getOfflineQueue());
        setLastFetchedAt(new Date());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load system status");
      } finally {
        setLoading(false);
      }
    };
    
    fetchStatus();
    const intervalId = setInterval(fetchStatus, 30000); // refresh every 30s
    return () => clearInterval(intervalId);
  }, []);

  if (loading && !status) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <Activity className="h-8 w-8 text-slate-400 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="text-red-500 flex flex-col items-center gap-2">
          <AlertTriangle className="h-8 w-8" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!status) return null;

  const endpointRows = Object.entries(observability?.endpoints || {}).sort((a, b) => b[1].count - a[1].count).slice(0, 8);

  const replayOfflineQueue = async () => {
    setReplayingQueue(true);
    try {
      const result = await api.replayOfflineQueue();
      setOfflineQueue(api.getOfflineQueue());
      toast.success(`Replay done: ${result.replayed} replayed, ${result.failed} failed, ${result.remaining} remaining.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to replay offline queue");
    } finally {
      setReplayingQueue(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">System Parameters & Status</h2>
            <p className="text-sm text-slate-600 mt-1">Real-time health of RadFlow processes</p>
            <p className="text-xs text-slate-500 mt-1">
              Real-time source: backend status API{lastFetchedAt ? ` @ ${lastFetchedAt.toLocaleTimeString()}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Active AI Model</label>
              <select 
                className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
                value={status.active_model || 'experiment1'}
                onChange={async (e) => {
                  const newModel = e.target.value;
                  try {
                    await api.setAiModel(newModel);
                    const data = await api.getSystemStatus();
                    setStatus(data);
                    toast.success(`Switched pipeline to ${newModel}`);
                  } catch (err) {
                    const message = err instanceof Error ? err.message : "Failed to update AI model";
                    toast.error(message);
                  }
                }}
              >
                <option value="experiment1">Experiment 1 (RadFlow-Edge Pipeline)</option>
                <option value="experiment2">Experiment 2 (Foveal Engine)</option>
                <option value="both">Both Experiments</option>
                <option value="none">AI Disabled</option>
              </select>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium disabled:opacity-50"
              disabled={reanalyzing}
              onClick={async () => {
                setReanalyzing(true);
                toast.info("Legacy reanalysis started. This may take a while on large datasets.");
                try {
                  const result = await api.reanalyzeLegacy({
                    onlyMissingFindings: true,
                    includeArchived: true,
                    continueOnError: true,
                  });
                  const message = `Processed ${result.processed}/${result.totalConsidered}; analyzed ${result.analyzed}, bootstrapped ${result.bootstrapped}, failed ${result.failed}.`;
                  if (result.failed > 0) {
                    toast.warning(message);
                  } else {
                    toast.success(message);
                  }
                } catch (err) {
                  const message = err instanceof Error ? err.message : "Failed to run legacy reanalysis";
                  toast.error(message);
                } finally {
                  setReanalyzing(false);
                }
              }}
            >
              {reanalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              {reanalyzing ? "Reanalyzing..." : "Admin: Reanalyze Legacy"}
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-200 text-sm font-medium h-fit">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              {status.status.toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
        
        {/* Core Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-3 text-slate-600 mb-2">
              <Cpu className="w-5 h-5 text-blue-500" />
              <span className="font-medium text-sm">CPU Usage</span>
            </div>
            <div className="text-3xl font-bold text-slate-900">{status.cpu_usage}%</div>
            <div className="w-full bg-slate-100 h-2 mt-3 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${status.cpu_usage > 80 ? 'bg-red-500' : 'bg-blue-500'}`} 
                style={{ width: `${status.cpu_usage}%` }}
              ></div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-3 text-slate-600 mb-2">
              <MemoryStick className="w-5 h-5 text-purple-500" />
              <span className="font-medium text-sm">Memory Usage</span>
            </div>
            <div className="text-3xl font-bold text-slate-900">{status.memory_usage}%</div>
            <div className="w-full bg-slate-100 h-2 mt-3 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${status.memory_usage > 80 ? 'bg-red-500' : 'bg-purple-500'}`} 
                style={{ width: `${status.memory_usage}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-3 text-slate-600 mb-2">
              <Clock className="w-5 h-5 text-green-500" />
              <span className="font-medium text-sm">Uptime</span>
            </div>
            <div className="text-3xl font-bold text-slate-900">{status.uptime}</div>
            <div className="text-sm text-slate-500 mt-2">Since last restart</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-3 text-slate-600 mb-2">
              <Users className="w-5 h-5 text-orange-500" />
              <span className="font-medium text-sm">Active Users</span>
            </div>
            <div className="text-3xl font-bold text-slate-900">{status.active_users}</div>
            <div className="text-sm text-slate-500 mt-2">Sessions currently open</div>
          </div>
        </div>

        {/* System Queue details & Processes */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <Server className="w-4 h-4 text-slate-500" /> 
                Running Processes
              </h3>
            </div>
            <div className="p-0">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Process Name</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">CPU</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Mem (MB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {status.running_processes.map((proc, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4 text-sm font-medium text-slate-900">{proc.name}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${proc.status === 'running' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>
                          {proc.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">{proc.cpu}%</td>
                      <td className="px-5 py-4 text-sm text-slate-600">{proc.mem}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-semibold text-slate-900 text-lg mb-4">Pipeline Queue</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-sm font-medium text-slate-600">Queue Length</span>
                  <span className="text-lg font-bold text-slate-900">{status.queue_length} images</span>
                </div>
                
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-sm font-medium text-slate-600">Avg Wait Time</span>
                  <span className="text-lg font-bold text-slate-900">{status.estimated_wait_time}</span>
                </div>

                <div className="flex justify-between items-center bg-red-50 p-3 rounded-lg border border-red-100">
                  <span className="text-sm font-medium text-red-700">Recent Errors (24h)</span>
                  <span className="text-lg font-bold text-red-700">{status.recent_errors}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 rounded-xl p-6 shadow-sm text-white">
              <h3 className="font-semibold text-slate-100 mb-2 flex items-center gap-2">
                <Play className="w-4 h-4 text-green-400" />
                Pipeline Stream
              </h3>
              <div className="font-mono text-xs text-slate-400 space-y-2 mt-4">
                {(status.pipeline_stream && status.pipeline_stream.length > 0
                  ? status.pipeline_stream
                  : [
                      `Pipeline mode: ${status.active_model || "unknown"}`,
                      `Queue length: ${status.queue_length}`,
                      `Estimated wait: ${status.estimated_wait_time}`,
                      `Recent errors: ${status.recent_errors}`,
                      "Awaiting next payload",
                    ]
                ).map((line, idx) => (
                  <p key={`${line}-${idx}`} className={idx === 0 ? "text-green-400" : "text-slate-300"}>{line}</p>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sophistication Console */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-slate-500" /> Endpoint Reliability (SLO)
              </h3>
            </div>
            <div className="p-0">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Endpoint</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Calls</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Errors</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg ms</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">P95 ms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {endpointRows.length === 0 ? (
                    <tr>
                      <td className="px-5 py-4 text-sm text-slate-500" colSpan={5}>No endpoint telemetry available yet.</td>
                    </tr>
                  ) : endpointRows.map(([endpoint, metric]) => (
                    <tr key={endpoint} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4 text-sm font-mono text-slate-800">{endpoint}</td>
                      <td className="px-5 py-4 text-sm text-slate-700">{metric.count}</td>
                      <td className="px-5 py-4 text-sm text-slate-700">{metric.errors}</td>
                      <td className="px-5 py-4 text-sm text-slate-700">{metric.avgMs}</td>
                      <td className="px-5 py-4 text-sm text-slate-700">{metric.p95Ms}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-semibold text-slate-900 text-lg mb-4 flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-slate-500" /> Async Inference Jobs
              </h3>
              <div className="space-y-2 max-h-64 overflow-auto">
                {jobs.length === 0 ? (
                  <div className="text-sm text-slate-500">No async jobs yet.</div>
                ) : jobs.map((job) => (
                  <div key={job.jobId} className="rounded-md border border-slate-200 p-2 text-xs">
                    <div className="font-mono text-slate-700 truncate">{job.jobId}</div>
                    <div className="flex justify-between mt-1">
                      <span className="capitalize">{job.status}</span>
                      <span>{job.progress}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-semibold text-slate-900 text-lg mb-4">Offline Replay Queue</h3>
              <div className="text-sm text-slate-600 mb-3">Pending items: {offlineQueue.length}</div>
              <Button className="w-full" variant="outline" onClick={replayOfflineQueue} disabled={replayingQueue || offlineQueue.length === 0}>
                {replayingQueue ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
                Replay Queue
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-semibold text-slate-900 text-lg mb-4">Model Warm State</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Experiment 1 Detector</span><span>{status.model_warm_state?.exp1_detector ? "Warm" : "Cold"}</span></div>
              <div className="flex justify-between"><span>Experiment 1 Analyzer</span><span>{status.model_warm_state?.exp1_analyzer ? "Warm" : "Cold"}</span></div>
              <div className="flex justify-between"><span>Experiment 2 Preprocessor</span><span>{status.model_warm_state?.exp2_preprocessor ? "Warm" : "Cold"}</span></div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-semibold text-slate-900 text-lg mb-4">Queue Depth by Stage</h3>
            <div className="space-y-2 text-sm">
              {Object.entries(status.queue_stage_depth || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between"><span className="capitalize">{k}</span><span>{v}</span></div>
              ))}
              <div className="flex justify-between text-amber-700"><span>Retry Count</span><span>{status.retry_count || 0}</span></div>
              <div className="flex justify-between text-red-700"><span>Failed Jobs</span><span>{status.failed_jobs || 0}</span></div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-semibold text-slate-900 text-lg mb-4">Drift Monitoring</h3>
            {driftReport ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Recent Runs (7d)</span><span>{driftReport.recentCount}</span></div>
                <div className="flex justify-between"><span>Baseline Runs</span><span>{driftReport.baselineCount}</span></div>
                <div className="flex justify-between"><span>Confidence Drift</span><span>{driftReport.confidenceDrift}</span></div>
                <div className="flex justify-between"><span>Low Quality Rate</span><span>{Math.round(driftReport.recentLowQualityRate * 100)}%</span></div>
              </div>
            ) : (
              <div className="text-sm text-slate-500 flex items-center gap-2"><AlertCircle className="h-4 w-4" />No drift report yet</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-semibold text-slate-900 text-lg mb-4">Recycle Bin Preview</h3>
          <div className="space-y-2 max-h-52 overflow-auto">
            {recycleItems.length === 0 ? (
              <div className="text-sm text-slate-500">No deleted patient histories.</div>
            ) : recycleItems.slice(0, 12).map((item) => {
              const deletedAt = item.deletedAt ? new Date(item.deletedAt) : null;
              const retentionDays = 30;
              const daysRemaining = deletedAt
                ? Math.max(0, retentionDays - Math.floor((Date.now() - deletedAt.getTime()) / (1000 * 60 * 60 * 24)))
                : retentionDays;
              return (
                <div key={item.patientId} className="rounded border border-amber-200 bg-amber-50 p-2 text-sm">
                  <div className="font-medium text-amber-900">{item.patientId}</div>
                  <div className="text-amber-800 text-xs">{item.caseCount} cases, {item.escalationCount} escalations</div>
                  <div className="text-amber-700 text-xs">Retention: {daysRemaining} day(s) remaining</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
