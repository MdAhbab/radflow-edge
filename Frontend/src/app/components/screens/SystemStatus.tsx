import { useState, useEffect } from "react";
import { 
  Server, 
  Activity, 
  Users, 
  Cpu, 
  MemoryStick, 
  Clock, 
  AlertTriangle,
  Play
} from "lucide-react";
import { api, SystemStatus as SystemStatusType } from "../../../api";

export function SystemStatus() {
  const [status, setStatus] = useState<SystemStatusType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      setLoading(true);
      try {
        const data = await api.getSystemStatus();
        setStatus(data);
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

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">System Parameters & Status</h2>
            <p className="text-sm text-slate-600 mt-1">Real-time health of RadFlow processes</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Active AI Model</label>
              <select 
                className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
                value={(status as any).active_model || 'experiment1'}
                onChange={async (e) => {
                  const newModel = e.target.value;
                  try {
                    await api.setAiModel(newModel);
                    const data = await api.getSystemStatus();
                    setStatus(data);
                  } catch (err) {
                    alert("Failed to update AI model");
                  }
                }}
              >
                <option value="experiment1">Experiment 1 (RadFlow-Edge Pipeline)</option>
                <option value="experiment2">Experiment 2 (Foveal Engine)</option>
                <option value="both">Both Experiments</option>
                <option value="none">AI Disabled</option>
              </select>
            </div>
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
                <p>DICOM recved: ID 88921</p>
                <p>Preproc... done</p>
                <p className="text-green-400">Model Foveal-v2 init...</p>
                <p>Inference completed (0.8s)</p>
                <p className="text-slate-500">Awaiting next payload</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
