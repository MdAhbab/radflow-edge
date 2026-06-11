import { useState, useEffect, useContext, createContext, useCallback } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router";
import {
  ListTodo,
  AlertTriangle,
  FilePlus,
  Activity,
  Settings,
  WifiOff,
  Clock,
  Database,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  User,
  BarChart3,
} from "lucide-react";
import { api } from "../../api";
import { Separator } from "./ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

/* ─────────────────────────────────────────────────────────
   HEADER CONTEXT — lets child pages inject left/right slots
───────────────────────────────────────────────────────── */
interface HeaderSlots {
  left?: React.ReactNode;
  right?: React.ReactNode;
}

interface HeaderContextValue {
  setSlots: (s: HeaderSlots) => void;
  clearSlots: () => void;
}

const HeaderContext = createContext<HeaderContextValue>({
  setSlots: () => {},
  clearSlots: () => {},
});

export function useHeader() {
  return useContext(HeaderContext);
}

/* ── helpers ── */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarColor(name: string): string {
  const colors = [
    "bg-blue-600", "bg-violet-600", "bg-teal-600",
    "bg-emerald-600", "bg-indigo-600", "bg-cyan-600",
  ];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

/* ─────────────────────────────────────────────────────────
   APP LAYOUT
───────────────────────────────────────────────────────── */
export function AppLayout() {
  const location  = useLocation();
  const navigate  = useNavigate();

  /* ── sidebar state ── */
  const [sidebarOpen, setSidebarOpen] = useState(true);

  /* ── header context slots ── */
  const [slots, setSlots] = useState<HeaderSlots>({});
  const setHeaderSlots  = useCallback((s: HeaderSlots) => setSlots(s), []);
  const clearHeaderSlots = useCallback(() => setSlots({}), []);

  /* ── live data ── */
  const [stats, setStats]     = useState({ worklist: 0, escalations: 0 });
  const [isOffline, setIsOffline] = useState(false);
  const [timeStr, setTimeStr] = useState("");
  const [dateStr, setDateStr] = useState("");

  const userName      = localStorage.getItem("hsil_user_name")      || "User";
  const userInstitute = localStorage.getItem("hsil_user_institute")  || "Dhaka Medical College";
  const userProfession =
    localStorage.getItem("hsil_user_profession")?.replace(/_/g, " ") || "Clinical Staff";

  /* ── clock ── */
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }));
      setDateStr(now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }));
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  /* ── sidebar counters ── */
  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      // Skip the badge refresh while the tab is hidden — no point spending
      // network/CPU on nav counts nobody is looking at.
      if (document.hidden) return;
      try {
        const [cases, escStats] = await Promise.all([api.getCases(), api.getEscalationStats()]);
        if (!mounted) return;
        const queue = cases.filter(c => c.aiStatus === "ready" || c.aiStatus === "analyzing");
        setStats({ worklist: queue.length, escalations: escStats.awaiting });
        setIsOffline(false);
      } catch {
        if (mounted) setIsOffline(true);
      }
    };
    fetch();
    const id = setInterval(fetch, 10_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  const handleSignOut = () => {
    ["hsil_user_name", "hsil_user_institute", "hsil_user_profession", "hsil_last_viewed_case"]
      .forEach(k => localStorage.removeItem(k));
    navigate("/");
  };

  /* ── nav structure ── */
  const workflowNav = [
    { path: "/dashboard",             label: "Patient Queue", icon: ListTodo,     badge: stats.worklist    || null },
    { path: "/dashboard/new-report",  label: "New Submission", icon: FilePlus,    badge: null },
    { path: "/dashboard/escalations", label: "Escalations",   icon: AlertTriangle, badge: isOffline ? null : stats.escalations || null },
    { path: "/dashboard/ehr",         label: "EHR",            icon: Database,    badge: null },
    { path: "/dashboard/insights",    label: "Insights",       icon: BarChart3,   badge: null },
  ];
  const systemNav = [{ path: "/dashboard/settings", label: "System", icon: Settings }];

  const isActive = (path: string) =>
    path === "/dashboard" ? location.pathname === "/dashboard" : location.pathname.startsWith(path);

  const initials  = getInitials(userName);
  const avatarBg  = avatarColor(userName);
  const hasSlots  = !!slots.left || !!slots.right;

  return (
    <HeaderContext.Provider value={{ setSlots: setHeaderSlots, clearSlots: clearHeaderSlots }}>
      <div className="h-screen flex flex-col bg-slate-50">

        {/* ── HEADER ───────────────────────────────────────────── */}
        <header className="bg-white border-b border-slate-200 h-14 flex items-center justify-between px-5 shrink-0 z-30">

          {/* Left: brand (default) OR injected slot */}
          {hasSlots && slots.left ? (
            <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
              {slots.left}
            </div>
          ) : (
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-blue-600 rounded-md shrink-0">
                  <Activity className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-bold text-slate-900 tracking-tight">RadFlow-Edge</span>
              </div>
              <Separator orientation="vertical" className="h-5" />
              <span className="text-sm text-slate-500 font-medium truncate max-w-[200px]">{userInstitute}</span>
            </div>
          )}

          {/* Right: optional injected actions + clock + profile */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Injected action buttons */}
            {hasSlots && slots.right && (
              <>
                {slots.right}
                <Separator orientation="vertical" className="h-5" />
              </>
            )}

            {/* Offline indicator — only shown when disconnected */}
            {isOffline && (
              <>
                <div className="flex items-center gap-1 text-red-500" title="Connection lost">
                  <WifiOff className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium text-red-600">Offline</span>
                </div>
                <Separator orientation="vertical" className="h-5" />
              </>
            )}

            {/* Clock */}
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium text-slate-700 tabular-nums">{timeStr}</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-400">{dateStr}</span>
            </div>

            <Separator orientation="vertical" className="h-5" />

            {/* Profile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100
                                   transition-colors duration-150 focus:outline-none focus-visible:ring-2
                                   focus-visible:ring-blue-500/40">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${avatarBg}`}>
                    {initials}
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-sm font-semibold text-slate-900 leading-tight">{userName}</div>
                    <div className="text-[11px] text-slate-500 capitalize leading-tight">{userProfession}</div>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-xl shadow-lg">
                <DropdownMenuLabel className="pb-1">
                  <div className="font-semibold text-slate-900 text-sm">{userName}</div>
                  <div className="text-xs text-slate-500 font-normal capitalize mt-0.5">{userProfession}</div>
                  <div className="text-xs text-slate-400 font-normal mt-0.5 truncate">{userInstitute}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 cursor-pointer">
                  <User className="h-3.5 w-3.5 text-slate-500" />
                  My Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* ── SIDEBAR ─────────────────────────────────────────── */}
          <div className="relative shrink-0">
          <aside
            className={`${sidebarOpen ? "w-56" : "w-14"} h-full bg-white border-r border-slate-200
                        flex flex-col transition-all duration-200 ease-in-out overflow-hidden`}
          >
            <nav className="flex-1 p-2 overflow-y-auto overflow-x-hidden space-y-4">
              {/* Workflow group */}
              <div>
                {sidebarOpen && (
                  <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    Workflow
                  </p>
                )}
                <div className="space-y-0.5">
                  {workflowNav.map((item) => {
                    const Icon  = item.icon;
                    const active = isActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        title={!sidebarOpen ? item.label : undefined}
                        className={`flex items-center rounded-lg text-sm font-medium
                          transition-colors duration-150 relative
                          ${sidebarOpen ? "gap-3 px-3 py-2.5" : "justify-center px-0 py-2.5"}
                          ${active
                            ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          }`}
                      >
                        <div className="relative shrink-0">
                          <Icon className="h-4 w-4" />
                          {/* Badge dot when collapsed */}
                          {!sidebarOpen && item.badge != null && item.badge > 0 && (
                            <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full border border-white
                              ${active ? "bg-blue-300" : "bg-blue-500"}`}
                            />
                          )}
                        </div>
                        {sidebarOpen && (
                          <>
                            <span className="flex-1 leading-none truncate">{item.label}</span>
                            {item.badge != null && item.badge > 0 && (
                              <span className={`text-[11px] font-semibold min-w-[18px] h-[18px] flex items-center
                                justify-center rounded-full px-1 shrink-0
                                ${active ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* System group */}
              <div>
                {sidebarOpen && (
                  <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    System
                  </p>
                )}
                <div className="space-y-0.5">
                  {systemNav.map((item) => {
                    const Icon  = item.icon;
                    const active = isActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        title={!sidebarOpen ? item.label : undefined}
                        className={`flex items-center rounded-lg text-sm font-medium
                          transition-colors duration-150
                          ${sidebarOpen ? "gap-3 px-3 py-2.5" : "justify-center px-0 py-2.5"}
                          ${active
                            ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {sidebarOpen && <span className="flex-1 leading-none truncate">{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </nav>

          </aside>

          {/* Edge collapse toggle — sits on the right border of the sidebar */}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            className="absolute -right-3 bottom-10 z-20 w-6 h-6 rounded-full bg-white
                       border border-slate-200 shadow-sm flex items-center justify-center
                       text-slate-400 hover:text-slate-700 hover:border-slate-300
                       hover:shadow-md transition-all duration-150"
          >
            {sidebarOpen
              ? <ChevronLeft className="h-3 w-3" />
              : <ChevronRight className="h-3 w-3" />
            }
          </button>
          </div>

          {/* ── MAIN CONTENT ─────────────────────────────────── */}
          <main className="flex-1 overflow-auto min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </HeaderContext.Provider>
  );
}
