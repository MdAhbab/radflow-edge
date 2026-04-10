import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router";
import { 
  ListTodo, 
  FileText, 
  AlertTriangle, 
  FilePlus, 
  Activity, 
  Settings, 
  WifiOff,
  Clock,
  User,
  Database
} from "lucide-react";
import { api } from "../../api";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";

export function AppLayout() {
  const location = useLocation();
  const [activeCaseId, setActiveCaseId] = useState<string>("");
  const [stats, setStats] = useState({ worklist: 0, escalations: 0 });
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const fetchSidebarData = async () => {
      try {
        const [, cases] = await Promise.all([
          api.getCaseStats(),
          api.getCases()
        ]);

        const activeQueueCases = cases.filter((c) => c.aiStatus === "ready" || c.aiStatus === "analyzing");
        
        // Sidebar worklist should reflect active queue, not all non-archived records.
        setStats({
          worklist: activeQueueCases.length,
          escalations: 0
        });

        if (cases && cases.length > 0) {
          const lastViewedCaseId = localStorage.getItem("hsil_last_viewed_case") || "";
          const lastViewedCase = cases.find((c) => c.patientId === lastViewedCaseId);
          const preferred =
            lastViewedCase ||
            cases.find((c) => c.aiStatus === "analyzing") ||
            cases.find((c) => c.aiStatus === "ready") ||
            cases.find((c) => c.aiStatus === "escalated") ||
            cases[0];
          setActiveCaseId(preferred.patientId);
        }

        const escStats = await api.getEscalationStats();
        setStats(prev => ({ ...prev, escalations: escStats.awaiting }));
        setIsOffline(false);

      } catch (err) {
        console.error("Connectivity error:", err);
        setIsOffline(true);
      }
    };

    fetchSidebarData();
    const interval = setInterval(fetchSidebarData, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { path: "/dashboard", label: "Worklist", icon: ListTodo },
    { path: `/dashboard/case/${activeCaseId}`, label: "Cases", icon: FileText },
    { path: "/dashboard/escalations", label: "Escalations", icon: AlertTriangle, badge: isOffline ? 0 : stats.escalations },
    { path: "/dashboard/ehr", label: "EHR", icon: Database },
    { path: "/dashboard/new-report", label: "New Report", icon: FilePlus },
    { path: "/dashboard/settings", label: "System Status & Settings", icon: Settings },
  ];

  const isActive = (path: string) => {
    if (path === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(path.replace(/#.*/, ""));
  };

  const currentTime = new Date().toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
  
  const currentDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'short',
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 h-14 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-semibold text-slate-900">RadFlow-Edge</h1>
          <Separator orientation="vertical" className="h-6" />
          <span className="text-sm text-slate-600">
            {localStorage.getItem("hsil_user_institute") || "Dhaka Medical College"}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <Badge 
            variant="outline" 
            className={`gap-1.5 ${isOffline ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}
          >
            <WifiOff className="h-3 w-3" />
            {isOffline ? "Connection Lost" : "Offline Mode Active"}
          </Badge>
          
          <Separator orientation="vertical" className="h-6" />
          
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Clock className="h-4 w-4" />
            <span>{currentTime}</span>
            <span className="text-slate-400">|</span>
            <span>{currentDate}</span>
          </div>
          
          <Separator orientation="vertical" className="h-6" />
          
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-slate-500" />
            <div className="text-sm">
              <div className="font-medium text-slate-900">
                {localStorage.getItem("hsil_user_name") || "Dr. Ahbab"}
              </div>
              <div className="text-xs text-slate-500 capitalize">
                {localStorage.getItem("hsil_user_profession")?.replace("_", " ") || "Specialist"}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
          <nav className="flex-1 p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              
              return (
                <Link
                  key={item.path}
                  to={item.path.startsWith("#") ? "#" : item.path}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors
                    ${active 
                      ? "bg-slate-900 text-white" 
                      : "text-slate-700 hover:bg-slate-100"
                    }
                  `}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <Badge 
                      variant="secondary" 
                      className={`
                        ${active ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}
                      `}
                    >
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-200">
            <div className="bg-slate-50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">System Health</span>
                <Badge 
                  variant="outline" 
                  className={isOffline ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"}
                >
                  {isOffline ? "Offline" : "Normal"}
                </Badge>
              </div>
              <div className="text-xs text-slate-500 space-y-0.5">
                <div className="flex justify-between">
                  <span>Current Queue:</span>
                  <span className="font-medium text-slate-700">{isOffline ? "N/A" : `${stats.worklist} cases`}</span>
                </div>
                <div className="flex justify-between">
                  <span>AI Engine:</span>
                  <span className={`font-medium ${isOffline ? "text-red-600" : "text-green-600"}`}>
                    {isOffline ? "Unreachable" : "Active"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
