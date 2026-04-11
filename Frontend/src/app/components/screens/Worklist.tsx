import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import {
  Search,
  Loader2,
  ClipboardList,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ChevronRight,
  ChevronLeft,
  FilePlus,
  RefreshCw,
  ChevronsLeft,
  ChevronsRight,
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
import { useHeader } from "../AppLayout";
import { api, CaseData, CaseStats } from "../../../api";

/* ─────────────────────────────────────────────────────────
   TRIAGE HELPERS
───────────────────────────────────────────────────────── */
const triageOrder: Record<string, number> = { red: 0, orange: 1, yellow: 2, green: 3 };

const triageConfig: Record<string, { label: string; rowBorder: string; rowBg: string; badgeCls: string }> = {
  red:    { label: "Critical",  rowBorder: "border-l-red-500",    rowBg: "bg-red-50/50",    badgeCls: "bg-red-100 text-red-800 border-red-300" },
  orange: { label: "Urgent",    rowBorder: "border-l-orange-400", rowBg: "",                badgeCls: "bg-orange-100 text-orange-800 border-orange-300" },
  yellow: { label: "Moderate",  rowBorder: "border-l-yellow-400", rowBg: "",                badgeCls: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  green:  { label: "Routine",   rowBorder: "border-l-green-500",  rowBg: "",                badgeCls: "bg-green-100 text-green-800 border-green-300" },
};

const aiStatusConfig: Record<string, { label: string; cls: string }> = {
  ready:    { label: "Ready to Review",     cls: "bg-blue-50 text-blue-700 border-blue-200" },
  analyzing:{ label: "Processing…",        cls: "bg-slate-100 text-slate-600 border-slate-300" },
  complete: { label: "Report Ready",        cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  escalated:{ label: "Sent to Specialist",  cls: "bg-violet-50 text-violet-700 border-violet-300" },
};

/* ─────────────────────────────────────────────────────────
   STAT CARD
───────────────────────────────────────────────────────── */
interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  borderCls: string;
  valueCls: string;
  bgCls: string;
}
function StatCard({ label, value, icon, borderCls, valueCls, bgCls }: StatCardProps) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3 border-l-4 ${borderCls}`}>
      <div className={`p-2 rounded-lg mt-0.5 ${bgCls}`}>{icon}</div>
      <div>
        <div className={`text-2xl font-bold tracking-tight ${valueCls}`}>{value}</div>
        <div className="text-xs text-slate-500 font-medium mt-0.5">{label}</div>
      </div>
    </div>
  );
}


/* ─────────────────────────────────────────────────────────
   EMPTY STATE
───────────────────────────────────────────────────────── */
function EmptyState({ filtered, onClearFilter }: { filtered: boolean; onClearFilter: () => void }) {
  if (filtered) {
    return (
      <TableRow>
        <TableCell colSpan={7} className="py-16 text-center">
          <p className="text-sm text-slate-500 mb-2">No cases match this filter.</p>
          <button
            onClick={onClearFilter}
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
            Clear filter
          </button>
        </TableCell>
      </TableRow>
    );
  }
  return (
    <TableRow>
      <TableCell colSpan={7} className="py-20 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 bg-slate-100 rounded-full">
            <ClipboardList className="h-6 w-6 text-slate-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">Queue is clear</p>
            <p className="text-xs text-slate-400 mt-0.5">No pending submissions right now</p>
          </div>
          <Link to="/dashboard/new-report">
            <Button size="sm" className="mt-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg gap-1.5">
              <FilePlus className="h-3.5 w-3.5" />
              New Submission
            </Button>
          </Link>
        </div>
      </TableCell>
    </TableRow>
  );
}

/* ─────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────── */
export function Worklist() {
  const { setSlots, clearSlots } = useHeader();
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseData[]>([]);
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  /* ── derived counts for tabs and stats ── */
  const pendingCount   = cases.filter(c => c.aiStatus === "ready" || c.aiStatus === "analyzing").length;
  const escalatedCount = cases.filter(c => c.aiStatus === "escalated").length;
  const urgentCount    = cases.filter(c => c.triageColor === "red").length;

  useEffect(() => {
    setSlots({
      left: (
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-blue-50 rounded-lg shrink-0">
            <ClipboardList className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-none">Clinical Worklist</h1>
            <p className="text-xs text-slate-500 mt-1 font-medium italic">Radiology Workflow Console</p>
          </div>
        </div>
      ),
      right: (
        <div className="flex items-center gap-2">
          <Link to="/dashboard/new-report">
            <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700 text-white shadow-sm px-4">
              <FilePlus className="h-4 w-4 mr-2" />
              New Case Submission
            </Button>
          </Link>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 w-9 p-0 border-slate-200 text-slate-500 hover:text-slate-900 shadow-sm" 
            onClick={() => { setLoading(true); fetchData(); }}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      )
    });
    return () => clearSlots();
  }, [setSlots, clearSlots, loading]);

  const fetchData = async () => {
    setError(null);
    try {
      const [casesData, statsData] = await Promise.all([api.getCases(), api.getCaseStats()]);
      setCases(casesData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load patient queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!mounted) return;
      await fetchData();
    };
    run();
    const id = setInterval(run, 10_000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  /* ── filter ── */
  const filtered = cases
    .filter((c) => {
      if (activeTab === "pending")   return c.aiStatus === "ready" || c.aiStatus === "analyzing";
      if (activeTab === "urgent")    return c.triageColor === "red";
      if (activeTab === "escalated") return c.aiStatus === "escalated";
      return true;
    })
    .filter((c) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.patientId.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.complaint.toLowerCase().includes(q)
      );
    })
;

  /* ── sort ── */
  // cases[] from the API is in DB insertion order: index 0 = oldest, last = newest
  const idxMap = new Map(cases.map((c, i) => [c.patientId, i]));

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "newest")     return (idxMap.get(b.patientId) ?? 0) - (idxMap.get(a.patientId) ?? 0);
    if (sortBy === "oldest")     return (idxMap.get(a.patientId) ?? 0) - (idxMap.get(b.patientId) ?? 0);
    if (sortBy === "priority")   return triageOrder[a.triageColor] - triageOrder[b.triageColor];
    if (sortBy === "name")       return a.name.localeCompare(b.name);
    return 0;
  });

  /* ── pagination ── */
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage   = Math.min(currentPage, totalPages);
  const paginated  = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const goTo = (p: number) => setCurrentPage(Math.max(1, Math.min(p, totalPages)));

  /* reset to page 1 on filter/search/tab changes */
  const resetPage = () => setCurrentPage(1);

  const handleRowClick = (patientId: string) => {
    localStorage.setItem("hsil_last_viewed_case", patientId);
    navigate(`/dashboard/case/${patientId}`);
  };

  const isFiltered = activeTab !== "all" || searchQuery.length > 0;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* ── SUB-HEADER / STATS ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 space-y-4 shrink-0">
        {/* ── STAT CARDS ──────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard
            label="Pending Review"
            value={pendingCount}
            icon={<ClipboardList className="h-4 w-4 text-blue-600" />}
            borderCls="border-l-blue-500"
            valueCls="text-blue-900"
            bgCls="bg-blue-50"
          />
          <StatCard
            label="Urgent (Critical)"
            value={urgentCount}
            icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
            borderCls="border-l-red-500"
            valueCls="text-red-900"
            bgCls="bg-red-50"
          />
          <StatCard
            label="Sent to Specialist"
            value={stats?.escalatedCases ?? escalatedCount}
            icon={<ArrowUpRight className="h-4 w-4 text-violet-600" />}
            borderCls="border-l-violet-500"
            valueCls="text-violet-900"
            bgCls="bg-violet-50"
          />
          <StatCard
            label="Completed Today"
            value={stats?.completedToday ?? 0}
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            borderCls="border-l-emerald-500"
            valueCls="text-emerald-900"
            bgCls="bg-emerald-50"
          />
        </div>

        {/* ── TABS ────────────────────────────────────────── */}
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); resetPage(); }}>
          <TabsList className="bg-slate-100 p-0.5 gap-0.5 h-auto rounded-xl">
            <TabsTrigger value="all" className="rounded-lg text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              All Cases
              <span className="ml-1.5 text-[10px] font-semibold text-slate-400">{stats?.totalCases ?? cases.length}</span>
            </TabsTrigger>
            <TabsTrigger value="pending" className="rounded-lg text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Pending Review
              <span className="ml-1.5 text-[10px] font-semibold text-slate-400">{pendingCount}</span>
            </TabsTrigger>
            <TabsTrigger value="urgent" className="rounded-lg text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Urgent
              {urgentCount > 0 && (
                <span className="ml-1.5 text-[10px] font-bold text-red-600">{urgentCount}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="escalated" className="rounded-lg text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Escalations
              <span className="ml-1.5 text-[10px] font-semibold text-slate-400">{escalatedCount}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* ── SEARCH + SORT ────────────────────────────────── */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Search by patient name, ID, or complaint…"
              className="pl-9 h-9 text-sm bg-slate-50 border-slate-200 focus-visible:ring-blue-500/40 rounded-xl"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); resetPage(); }}
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => { setSortBy(v); resetPage(); }}>
            <SelectTrigger className="w-44 h-9 text-sm rounded-xl bg-slate-50 border-slate-200">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="priority">Priority Level</SelectItem>
              <SelectItem value="name">Patient Name</SelectItem>
            </SelectContent>
          </Select>
        </div>

      </div>

      {/* ── CASES TABLE ──────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-5">
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setLoading(true); fetchData(); }}
              className="gap-1.5 border-red-300 text-red-700 hover:bg-red-100 rounded-lg"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 border-b border-slate-200">
                  <TableHead className="w-[140px] pl-5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Patient</TableHead>
                  <TableHead className="w-[72px] text-xs font-semibold text-slate-500 uppercase tracking-wide">Age / Sex</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Chief Complaint</TableHead>
                  <TableHead className="w-[160px] text-xs font-semibold text-slate-500 uppercase tracking-wide">Received</TableHead>
                  <TableHead className="w-[155px] text-xs font-semibold text-slate-500 uppercase tracking-wide">AI Status</TableHead>
                  <TableHead className="w-[100px] text-xs font-semibold text-slate-500 uppercase tracking-wide">Triage</TableHead>
                  <TableHead className="w-[110px] text-right pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-16 text-center">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">Fetching patient queue…</p>
                    </TableCell>
                  </TableRow>
                ) : sorted.length === 0 ? (
                  <EmptyState
                    filtered={isFiltered}
                    onClearFilter={() => {
                      setActiveTab("all");
                      setSearchQuery("");
                    }}
                  />
                ) : (
                  paginated.map((c) => {
                    const triage = triageConfig[c.triageColor] ?? triageConfig.green;
                    const aiSt   = aiStatusConfig[c.aiStatus]  ?? { label: c.aiStatus, cls: "bg-slate-100 text-slate-600 border-slate-200" };
                    const isReady    = c.aiStatus === "ready";
                    const isCritical = c.triageColor === "red";

                    return (
                      <TableRow
                        key={c.patientId}
                        onClick={() => handleRowClick(c.patientId)}
                        className={`border-l-4 cursor-pointer transition-colors duration-100
                          ${triage.rowBorder} ${triage.rowBg}
                          hover:bg-slate-50`}
                      >
                        {/* Patient */}
                        <TableCell className="pl-4 py-3">
                          <div className="font-semibold text-sm text-slate-900 leading-tight">{c.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">{c.patientId}</div>
                        </TableCell>

                        {/* Age / Sex */}
                        <TableCell className="text-sm text-slate-600">
                          {c.age} / {c.sex}
                        </TableCell>

                        {/* Chief Complaint */}
                        <TableCell>
                          <div className="text-sm text-slate-700 whitespace-normal leading-snug md:columns-2 md:gap-4 [column-fill:balance]">
                            {c.complaint}
                          </div>
                        </TableCell>

                        {/* Received */}
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-slate-500">
                            <Clock className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                            {c.timeReceived}
                          </div>
                        </TableCell>

                        {/* AI Status */}
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs gap-1 font-medium ${aiSt.cls}`}
                          >
                            {c.aiStatus === "analyzing" && (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            )}
                            {aiSt.label}
                          </Badge>
                        </TableCell>

                        {/* Triage */}
                        <TableCell>
                          <Badge variant="outline" className={`text-xs font-medium ${triage.badgeCls}`}>
                            {triage.label}
                          </Badge>
                        </TableCell>

                        {/* Open Case */}
                        <TableCell className="text-right pr-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowClick(c.patientId);
                            }}
                            className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5
                              rounded-lg border transition-colors duration-150
                              ${isReady || isCritical
                                ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-500"
                                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                              }`}
                          >
                            Open Case
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {/* ── PAGINATION FOOTER ───────────────────────────── */}
            {!loading && sorted.length > 0 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/60">

                {/* Left: count + page size */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">
                    Showing{" "}
                    <span className="font-semibold text-slate-700">
                      {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)}
                    </span>
                    {" "}of{" "}
                    <span className="font-semibold text-slate-700">{sorted.length}</span>
                    {" "}cases
                  </span>
                  <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                    <SelectTrigger className="h-7 w-24 text-xs rounded-lg bg-white border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg">
                      {[8, 15, 25, 50].map(n => (
                        <SelectItem key={n} value={String(n)} className="text-xs">{n} / page</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Right: page buttons */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => goTo(1)}
                    disabled={safePage === 1}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700
                               disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150"
                  >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => goTo(safePage - 1)}
                    disabled={safePage === 1}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700
                               disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>

                  {/* Page number pills */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                    .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === "…" ? (
                        <span key={`ellipsis-${i}`} className="px-1 text-xs text-slate-400">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => goTo(p as number)}
                          className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-medium transition-colors duration-150
                            ${safePage === p
                              ? "bg-blue-600 text-white shadow-sm"
                              : "text-slate-600 hover:bg-slate-200"
                            }`}
                        >
                          {p}
                        </button>
                      )
                    )
                  }

                  <button
                    onClick={() => goTo(safePage + 1)}
                    disabled={safePage === totalPages}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700
                               disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => goTo(totalPages)}
                    disabled={safePage === totalPages}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700
                               disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150"
                  >
                    <ChevronsRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
