import { useState, useEffect } from "react";
import { Link } from "react-router";
import { 
  Search, 
  Filter, 
  ChevronDown, 
  Eye, 
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { api, CaseData, CaseStats } from "../../../api";

export function Worklist() {
  const [cases, setCases] = useState<CaseData[]>([]);
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const newCount = cases.filter(c => c.aiStatus === "ready" || c.aiStatus === "analyzing").length;
  const readyCount = cases.filter(c => c.aiStatus === "ready").length;
  const escalatedCount = cases.filter(c => c.aiStatus === "escalated").length;

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      if (!mounted) return;
      setError(null);
      try {
        const [casesData, statsData] = await Promise.all([
          api.getCases(),
          api.getCaseStats()
        ]);
        if (!mounted) return;
        setCases(casesData);
        setStats(statsData);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to fetch data");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    setLoading(true);
    fetchData();
    const intervalId = setInterval(fetchData, 10000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const getTriageBadge = (color: string, priority?: string) => {
    const variants = {
      red: "bg-red-100 text-red-800 border-red-300",
      orange: "bg-orange-100 text-orange-800 border-orange-300",
      yellow: "bg-yellow-100 text-yellow-800 border-yellow-300",
      green: "bg-green-100 text-green-800 border-green-300"
    };

    const labels = {
      red: priority || "High Priority",
      orange: priority || "Moderate",
      yellow: priority || "Low Priority",
      green: priority || "Normal"
    };

    return (
      <Badge variant="outline" className={variants[color as keyof typeof variants]}>
        {labels[color as keyof typeof labels]}
      </Badge>
    );
  };

  const getAIStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return (
          <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
            <AlertCircle className="h-3 w-3" />
            AI Ready
          </Badge>
        );
      case "analyzing":
        return (
          <Badge variant="outline" className="gap-1 bg-slate-100 text-slate-700 border-slate-300">
            <Loader2 className="h-3 w-3 animate-spin" />
            Analyzing
          </Badge>
        );
      case "complete":
        return (
          <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200">
            <CheckCircle className="h-3 w-3" />
            Complete
          </Badge>
        );
      case "escalated":
        return (
          <Badge variant="outline" className="gap-1 bg-purple-50 text-purple-700 border-purple-300">
            <AlertCircle className="h-3 w-3" />
            Escalated
          </Badge>
        );
      default:
        return null;
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence === 0) return <span className="text-slate-400">—</span>;
    
    // Scale up from 0-1 to 0-100%
    const scale = confidence <= 1 ? 100 : 1; 
    const value = Math.round(confidence * scale);
    
    let color = "text-slate-700";
    if (value >= 85) color = "text-green-700";
    else if (value >= 70) color = "text-yellow-700";
    else color = "text-orange-700";

    return <span className={`font-medium ${color}`}>{value}%</span>;
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Patient Worklist</h2>
            <p className="text-sm text-slate-600 mt-1">Active radiology triage queue</p>
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
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-2xl font-semibold text-blue-900">{newCount}</div>
            <div className="text-sm text-blue-700">Queue Cases</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-2xl font-semibold text-red-900">{stats?.urgentCases || 0}</div>
            <div className="text-sm text-red-700">Urgent Cases</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="text-2xl font-semibold text-purple-900">{stats?.escalatedCases || 0}</div>
            <div className="text-sm text-purple-700">Escalated</div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="all">All Cases ({stats?.totalCases || 0})</TabsTrigger>
            <TabsTrigger value="new">New ({newCount})</TabsTrigger>
            <TabsTrigger value="ready">AI Ready ({readyCount})</TabsTrigger>
            <TabsTrigger value="priority">High Priority ({stats?.urgentCases || 0})</TabsTrigger>
            <TabsTrigger value="escalated">Escalated ({escalatedCount})</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search and Sort */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search by patient ID, name, or complaint..." 
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select defaultValue="time">
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="time">Time Received</SelectItem>
              <SelectItem value="priority">Priority Level</SelectItem>
              <SelectItem value="confidence">AI Confidence</SelectItem>
              <SelectItem value="name">Patient Name</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cases Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-lg border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Age/Sex</TableHead>
                <TableHead>Complaint</TableHead>
                <TableHead>Study Type</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>AI Status</TableHead>
                <TableHead>Triage</TableHead>
                <TableHead className="text-right">Confidence</TableHead>
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
              ) : (
                cases.filter(case_ => {
                  if (activeTab === "new") return case_.aiStatus === "ready" || case_.aiStatus === "analyzing";
                  if (activeTab === "ready") return case_.aiStatus === "ready";
                  if (activeTab === "priority") return case_.priority === "High Priority" || case_.priority === "immediate" || case_.priority === "urgent";
                  if (activeTab === "escalated") return case_.aiStatus === "escalated";
                  return true;
                }).filter(case_ => {
                  if (!searchQuery) return true;
                  const query = searchQuery.toLowerCase();
                  return case_.patientId.toLowerCase().includes(query) ||
                         case_.name.toLowerCase().includes(query) ||
                         case_.complaint.toLowerCase().includes(query);
                }).map((case_) => (
                  <TableRow key={case_.patientId} className="group">
                  <TableCell className="font-mono text-sm">{case_.patientId}</TableCell>
                  <TableCell className="font-medium">{case_.name}</TableCell>
                  <TableCell className="text-slate-600">
                    {case_.age} / {case_.sex}
                  </TableCell>
                  <TableCell className="max-w-md">
                    <div className="text-sm text-slate-700 truncate">
                      {case_.complaint}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">{case_.studyType}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {case_.timeReceived}
                    </div>
                  </TableCell>
                  <TableCell>{getAIStatusBadge(case_.aiStatus)}</TableCell>
                  <TableCell>{getTriageBadge(case_.triageColor, case_.priority)}</TableCell>
                  <TableCell className="text-right">
                    {getConfidenceBadge(case_.confidence)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link to={`/dashboard/case/${case_.patientId}`}>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => localStorage.setItem("hsil_last_viewed_case", case_.patientId)}
                      >
                        <Eye className="h-4 w-4 mr-1.5" />
                        Review
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              )))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
