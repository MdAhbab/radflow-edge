import { useState, useEffect } from "react";
import { Link } from "react-router";
import { 
  Search, 
  Filter,
  Eye,
  Clock,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Loader2,
  CheckCircle2
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
import { api, EscalationData, EscalationStats } from "../../../api";


export function Escalations() {
  const [cases, setCases] = useState<EscalationData[]>([]);
  const [stats, setStats] = useState<EscalationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("awaiting");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [casesData, statsData] = await Promise.all([
          api.getEscalations(),
          api.getEscalationStats()
        ]);
        setCases(casesData);
        setStats(statsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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

  const awaitingCount = stats?.awaiting || 0;
  const inReviewCount = stats?.inReview || 0;
  const returnedCount = stats?.returned || 0;
  const finalizedCount = stats?.finalized || 0;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Specialist Escalations</h2>
            <p className="text-sm text-slate-600 mt-1">Cases referred for expert review</p>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
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
                <TableHead className="text-right">Confidence</TableHead>
                <TableHead>Time Waiting</TableHead>
                {activeTab === "in-review" && <TableHead>Assigned To</TableHead>}
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400 mx-auto" />
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-red-600">
                    {error}
                  </TableCell>
                </TableRow>
              ) : filteredCases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-slate-500">
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
                      <div className="text-sm text-slate-700">
                        {case_.reasonForEscalation}
                      </div>
                    </TableCell>
                    <TableCell>{getPriorityBadge(case_.priority)}</TableCell>
                    <TableCell>{getTriageBadge(case_.aiTriage)}</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-medium ${
                        case_.confidence >= 85 ? "text-green-700" :
                        case_.confidence >= 70 ? "text-yellow-700" :
                        "text-orange-700"
                      }`}>
                        {case_.confidence}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        {case_.timeWaiting}
                      </div>
                    </TableCell>
                    {activeTab === "in-review" && (
                      <TableCell className="text-sm text-slate-700">
                        {case_.assignedTo || "—"}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
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
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

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
