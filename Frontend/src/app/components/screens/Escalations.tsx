import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { 
  Search, 
  Filter,
  Eye,
  Clock,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Loader2,
  CheckCircle2,
  RefreshCw,
  UserCheck
} from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { useHeader } from "../AppLayout";
import { api, EscalationData, EscalationStats, EscalationTimelineEvent } from "../../../api";
import { toast } from "sonner";


export function Escalations() {
  const { setSlots, clearSlots } = useHeader();
  const navigate = useNavigate();
  const [cases, setCases] = useState<EscalationData[]>([]);
  const [stats, setStats] = useState<EscalationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("awaiting");
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingPatientId, setUpdatingPatientId] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  const [selectedTimelinePatient, setSelectedTimelinePatient] = useState<string>("");
  const [timelineEvents, setTimelineEvents] = useState<EscalationTimelineEvent[]>([]);

  useEffect(() => {
    setSlots({
      left: (
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-50 rounded-lg shrink-0">
            <TrendingUp className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-none">Specialist Escalations</h1>
            <p className="text-xs text-slate-500 mt-1 font-medium italic">Radiology Expert Review Queue</p>
          </div>
        </div>
      ),
      right: (
        <div className="flex items-center gap-2">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mr-2">
            {lastUpdatedAt ? `Updated ${secondsSinceUpdate}s ago` : "Syncing..."}
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm" 
            onClick={() => fetchData(true)} 
            disabled={refreshing || loading}
          >
            {refreshing || loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh Queue
          </Button>
        </div>
      )
    });
    return () => clearSlots();
  }, [setSlots, clearSlots, lastUpdatedAt, secondsSinceUpdate, refreshing, loading]);

  const computeStatsFromCases = (items: EscalationData[]): EscalationStats => {
    const count = (status: EscalationData["status"]) => items.filter((item) => item.status === status).length;
    return {
      awaiting: count("awaiting"),
      inReview: count("in-review"),
      returned: count("returned"),
      finalized: count("finalized"),
    };
  };

  const applyOptimisticStatus = (
    patientId: string,
    status: EscalationData["status"],
    assignedTo?: string,
  ): EscalationData[] => {
    const nextCases = cases.map((item) =>
      item.patientId === patientId
        ? {
            ...item,
            status,
            assignedTo: assignedTo === undefined ? item.assignedTo : assignedTo,
          }
        : item
    );
    setCases(nextCases);
    setStats(computeStatsFromCases(nextCases));
    return nextCases;
  };

  const fetchData = async (background = false) => {
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);
    try {
      const [casesData, statsData] = await Promise.all([
        api.getEscalations(),
        api.getEscalationStats()
      ]);
      setCases(casesData);
      setStats(statsData);
      setLastUpdatedAt(new Date());
      setSecondsSinceUpdate(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData(false);
    const interval = setInterval(() => {
      fetchData(true);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!lastUpdatedAt) return;
    const timer = setInterval(() => {
      const elapsed = Math.max(0, Math.floor((Date.now() - lastUpdatedAt.getTime()) / 1000));
      setSecondsSinceUpdate(elapsed);
    }, 1000);
    return () => clearInterval(timer);
  }, [lastUpdatedAt]);

  const handleStartReview = async (case_: EscalationData) => {
    setUpdatingPatientId(case_.patientId);
    const previousCases = cases;
    applyOptimisticStatus(case_.patientId, "in-review", case_.assignedTo || "Available Specialist");
    try {
      await api.updateEscalation(case_.patientId, {
        status: "in-review",
        assignedTo: case_.assignedTo || "Available Specialist",
      });
      toast.success(`Marked ${case_.patientId} as in-review and opened specialist workspace.`);
      await fetchData(true);
      navigate(`/dashboard/specialist/${case_.patientId}`);
    } catch (err) {
      setCases(previousCases);
      setStats(computeStatsFromCases(previousCases));
      toast.error(err instanceof Error ? err.message : "Failed to update escalation status");
    } finally {
      setUpdatingPatientId(null);
    }
  };

  const handleSendBackToAwaiting = async (case_: EscalationData) => {
    setUpdatingPatientId(case_.patientId);
    const previousCases = cases;
    applyOptimisticStatus(case_.patientId, "awaiting", undefined);
    try {
      await api.updateEscalation(case_.patientId, {
        status: "awaiting",
        assignedTo: undefined,
      });
      toast.success(`Moved ${case_.patientId} back to awaiting queue.`);
      await fetchData(true);
    } catch (err) {
      setCases(previousCases);
      setStats(computeStatsFromCases(previousCases));
      toast.error(err instanceof Error ? err.message : "Failed to update escalation status");
    } finally {
      setUpdatingPatientId(null);
    }
  };

  const getPriorityBadge = (priority: string) => {
    const variants = {
      immediate: "bg-red-100 text-red-800 border-red-300",
      urgent: "bg-orange-100 text-orange-800 border-orange-300",
      routine: "bg-blue-100 text-blue-800 border-blue-300"
    };

    const labels = {
      immediate: "Immediate",
      urgent: "Urgent",
      routine: "Routine"
    };

    return (
      <Badge variant="outline" className={variants[priority as keyof typeof variants]}>
        {labels[priority as keyof typeof labels]}
      </Badge>
    );
  };

  const getTriageBadge = (color: string) => {
    const variants = {
      red: "bg-red-100 text-red-800 border-red-300",
      orange: "bg-orange-100 text-orange-800 border-orange-300",
      yellow: "bg-yellow-100 text-yellow-800 border-yellow-300"
    };

    return (
      <Badge variant="outline" className={variants[color as keyof typeof variants]}>
        {color.charAt(0).toUpperCase() + color.slice(1)}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "awaiting":
        return (
          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
            Awaiting
          </Badge>
        );
      case "in-review":
        return (
          <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
            <Eye className="h-3 w-3" />
            In Review
          </Badge>
        );
      case "returned":
        return (
          <Badge variant="outline" className="gap-1 bg-yellow-50 text-yellow-700 border-yellow-200">
            <ArrowRight className="h-3 w-3" />
            Returned
          </Badge>
        );
      case "finalized":
        return (
          <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200">
            Finalized
          </Badge>
        );
      default:
        return null;
    }
  };

  const getFilteredCases = () => {
    return cases.filter(case_ => {
      if (activeTab === "awaiting") return case_.status === "awaiting";
      if (activeTab === "in-review") return case_.status === "in-review";
      if (activeTab === "returned") return case_.status === "returned";
      if (activeTab === "finalized") return case_.status === "finalized";
      return true;
    }).filter(case_ => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return case_.patientId.toLowerCase().includes(query) ||
             case_.name.toLowerCase().includes(query) ||
             case_.reasonForEscalation.toLowerCase().includes(query);
    });
  };

  const filteredCases = getFilteredCases();

  const assignmentLoad = cases.reduce<Record<string, number>>((acc, c) => {
    const key = c.assignedTo || "Unassigned";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const agingLabel = (timeWaiting: string): string => {
    const match = timeWaiting.match(/(\d+)h/);
    const hours = match ? Number(match[1]) : 0;
    if (hours >= 8) return "Critical Aging";
    if (hours >= 4) return "Needs Attention";
    return "Within SLA";
  };

  const loadTimeline = async (patientId: string) => {
    setSelectedTimelinePatient(patientId);
    try {
      const events = await api.getEscalationTimeline(patientId);
      setTimelineEvents(events);
    } catch {
      setTimelineEvents([]);
    }
  };

  const awaitingCount = stats?.awaiting || 0;
  const inReviewCount = stats?.inReview || 0;
  const returnedCount = stats?.returned || 0;
  const finalizedCount = stats?.finalized || 0;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Summary Stats */}
      <div className="bg-white border-b border-slate-200 p-6 space-y-4 shrink-0">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-semibold text-slate-900">{awaitingCount}</div>
                <div className="text-sm text-slate-600">Awaiting Review</div>
              </div>
              <Clock className="h-8 w-8 text-slate-400" />
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-semibold text-blue-900">{inReviewCount}</div>
                <div className="text-sm text-blue-700">In Review</div>
              </div>
              <Eye className="h-8 w-8 text-blue-400" />
            </div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-semibold text-yellow-900">{returnedCount}</div>
                <div className="text-sm text-yellow-700">Returned to Clinic</div>
              </div>
              <ArrowRight className="h-8 w-8 text-yellow-400" />
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-semibold text-green-900">{finalizedCount}</div>
                <div className="text-sm text-green-700">Finalized Today</div>
              </div>
              <TrendingUp className="h-8 w-8 text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-sm font-semibold text-slate-900 mb-2">Assignment Board</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(assignmentLoad).length === 0 ? (
              <span className="text-sm text-slate-500">No assignments yet.</span>
            ) : (
              Object.entries(assignmentLoad).map(([name, count]) => (
                <Badge key={name} variant="outline" className="bg-slate-50">{name}: {count}</Badge>
              ))
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="awaiting">
              Awaiting Specialist ({awaitingCount})
            </TabsTrigger>
            <TabsTrigger value="in-review">
              In Review ({inReviewCount})
            </TabsTrigger>
            <TabsTrigger value="returned">
              Returned ({returnedCount})
            </TabsTrigger>
            <TabsTrigger value="finalized">
              Finalized ({finalizedCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search by patient ID, name, or reason for escalation..." 
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Escalations Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-lg border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Age/Sex</TableHead>
                <TableHead>Reason for Escalation</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>AI Triage</TableHead>
                <TableHead>Aging Alert</TableHead>
                {activeTab === "in-review" && <TableHead>Assigned To</TableHead>}
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={activeTab === "in-review" ? 9 : 8} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400 mx-auto" />
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={activeTab === "in-review" ? 9 : 8} className="text-center py-8 text-red-600">
                    {error}
                  </TableCell>
                </TableRow>
              ) : filteredCases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={activeTab === "in-review" ? 9 : 8} className="text-center py-8 text-slate-500">
                    No cases in this category
                  </TableCell>
                </TableRow>
              ) : (
                filteredCases.map((case_) => (
                  <TableRow key={case_.patientId} className="group">
                    <TableCell className="font-mono text-sm">{case_.patientId}</TableCell>
                    <TableCell className="font-medium">{case_.name}</TableCell>
                    <TableCell className="text-slate-600">
                      {case_.age} / {case_.sex}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="text-sm text-slate-700 leading-snug md:columns-2 md:gap-4 [column-fill:balance]">
                        {case_.reasonForEscalation}
                      </div>
                    </TableCell>
                    <TableCell>{getPriorityBadge(case_.priority)}</TableCell>
                    <TableCell>{getTriageBadge(case_.aiTriage)}</TableCell>
                    <TableCell>
                      <Badge variant={agingLabel(case_.timeWaiting) === "Critical Aging" ? "destructive" : "outline"}>
                        {agingLabel(case_.timeWaiting)}
                      </Badge>
                    </TableCell>
                    {activeTab === "in-review" && (
                      <TableCell className="text-sm text-slate-700">
                        {case_.assignedTo || "—"}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {case_.status === "awaiting" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStartReview(case_)}
                            disabled={updatingPatientId === case_.patientId}
                          >
                            {updatingPatientId === case_.patientId ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <UserCheck className="h-4 w-4 mr-1.5" />}
                            Start Review
                          </Button>
                        )}
                        {case_.status === "in-review" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSendBackToAwaiting(case_)}
                            disabled={updatingPatientId === case_.patientId}
                          >
                            {updatingPatientId === case_.patientId ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-1.5" />}
                            Return Queue
                          </Button>
                        )}
                        <Link to={`/dashboard/specialist/${case_.patientId}`}>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Eye className="h-4 w-4 mr-1.5" />
                            Open Review
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => loadTimeline(case_.patientId)}
                        >
                          Timeline
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {selectedTimelinePatient && (
          <div className="bg-white rounded-lg border border-slate-200 mt-4 p-4">
            <div className="text-sm font-semibold text-slate-900 mb-2">Escalation Timeline: {selectedTimelinePatient}</div>
            <div className="space-y-2 max-h-48 overflow-auto">
              {timelineEvents.length === 0 ? (
                <div className="text-sm text-slate-500">No timeline events found.</div>
              ) : (
                timelineEvents.map((ev, idx) => (
                  <div key={`${ev.timestamp}-${idx}`} className="text-xs border rounded p-2 bg-slate-50">
                    <div className="font-medium text-slate-800">{ev.eventType} ({ev.oldStatus || "-"} -&gt; {ev.newStatus || "-"})</div>
                    <div className="text-slate-600">{new Date(ev.timestamp).toLocaleString()}</div>
                    {ev.reason && <div className="text-slate-700 mt-1">{ev.reason}</div>}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Priority Alert - Only show if immediate cases exist */}
        {activeTab === "awaiting" && filteredCases.some(c => c.priority === "immediate") && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-red-900">Immediate Priority Cases Waiting</div>
              <div className="text-sm text-red-700 mt-1">
                {filteredCases.filter(c => c.priority === "immediate").length} immediate priority case(s) waiting for review. Please escalate to available specialist.
              </div>
            </div>
          </div>
        )}

        {/* System Ready State - Show when all clear */}
        {activeTab === "awaiting" && filteredCases.length === 0 && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3 text-emerald-800">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span className="font-medium">All specialist review queues are clear. Clinical staff can continue submitting new reports.</span>
          </div>
        )}
      </div>
    </div>
  );
}
