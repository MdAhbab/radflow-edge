import { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router";
import {
  ListTodo,
  AlertTriangle,
  FilePlus,
  Activity,
  Settings,
  WifiOff,
  Wifi,
  Clock,
  Database,
  LogOut,
  ChevronDown,
  User,
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

/* ── helper: compute 2-letter initials from a full name ── */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ── helper: stable background color from name ── */
function avatarColor(name: string): string {
  const colors = [
    "bg-blue-600",
    "bg-violet-600",
    "bg-teal-600",
    "bg-emerald-600",
    "bg-indigo-600",
    "bg-cyan-600",
  ];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ worklist: 0, escalations: 0 });
  const [isOffline, setIsOffline] = useState(false);
  const [timeStr, setTimeStr] = useState("");
  const [dateStr, setDateStr] = useState("");

  const userName = localStorage.getItem("hsil_user_name") || "User";
  const userInstitute = localStorage.getItem("hsil_user_institute") || "Dhaka Medical College";
  const userProfession =
    localStorage.getItem("hsil_user_profession")?.replace(/_/g, " ") || "Clinical Staff";

  /* ── live clock ── */
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
      );
      setDateStr(
        now.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      );
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  /* ── sidebar data ── */
  useEffect(() => {
    const fetchSidebarData = async () => {
      try {
        const [, cases] = await Promise.all([api.getCaseStats(), api.getCases()]);
        const queueCases = cases.filter(
          (c) => c.aiStatus === "ready" || c.aiStatus === "analyzing"
        );
        setStats({ worklist: queueCases.length, escalations: 0 });
        const escStats = await api.getEscalationStats();
        setStats((prev) => ({ ...prev, escalations: escStats.awaiting }));
        setIsOffline(false);
      } catch {
        setIsOffline(true);
      }
    };
    fetchSidebarData();
    const id = setInterval(fetchSidebarData, 10_000);
    return () => clearInterval(id);
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem("hsil_user_name");
    localStorage.removeItem("hsil_user_institute");
    localStorage.removeItem("hsil_user_profession");
    localStorage.removeItem("hsil_last_viewed_case");
    navigate("/");
  };

  /* ── nav structure ── */
  const workflowNav = [
    {
      path: "/dashboard",
      label: "Patient Queue",
      icon: ListTodo,
      badge: stats.worklist || null,
    },
    { path: "/dashboard/new-report", label: "New Submission", icon: FilePlus },
    {
      path: "/dashboard/escalations",
      label: "Escalations",
      icon: AlertTriangle,
      badge: isOffline ? null : stats.escalations || null,
    },
    { path: "/dashboard/ehr", label: "EHR", icon: Database },
  ];

  const systemNav = [{ path: "/dashboard/settings", label: "System", icon: Settings }];

  const isActive = (path: string) => {
    if (path === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(path);
  };

  const initials = getInitials(userName);
  const avatarBg = avatarColor(userName);

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* ── TOP BAR ─────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 h-14 flex items-center justify-between px-6 shrink-0 z-30">
        {/* Left: brand + institute */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-blue-600 rounded-md">
              <Activity className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold text-slate-900 tracking-tight">RadFlow-Edge</span>
          </div>
          <Separator orientation="vertical" className="h-5" />
          <span className="text-sm text-slate-500 font-medium">{userInstitute}</span>
        </div>

        {/* Right: connectivity + clock + profile */}
        <div className="flex items-center gap-3">
          {/* Connectivity */}
          <div
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border
              ${isOffline
                ? "bg-red-50 text-red-700 border-red-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
          >
            {isOffline ? (
              <WifiOff className="h-3 w-3" />
            ) : (
              <Wifi className="h-3 w-3" />
            )}
            {isOffline ? "Connection Lost" : "AI Connected"}
          </div>

          <Separator orientation="vertical" className="h-5" />

          {/* Clock */}
          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-medium text-slate-700 tabular-nums">{timeStr}</span>
            <span className="text-slate-300">·</span>
            <span>{dateStr}</span>
          </div>

          <Separator orientation="vertical" className="h-5" />

          {/* Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-100
                           transition-colors duration-150 focus:outline-none focus-visible:ring-2
                           focus-visible:ring-blue-500/40"
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${avatarBg}`}
                >
                  {initials}
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-slate-900 leading-tight">{userName}</div>
                  <div className="text-[11px] text-slate-500 capitalize leading-tight">{userProfession}</div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 ml-0.5" />
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
        <aside className="w-56 bg-white border-r border-slate-200 flex flex-col shrink-0">
          <nav className="flex-1 p-3 space-y-5 overflow-y-auto">
            {/* Workflow group */}
            <div>
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Workflow
              </p>
              <div className="space-y-0.5">
                {workflowNav.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                        transition-colors duration-150
                        ${active
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 leading-none">{item.label}</span>
                      {item.badge != null && item.badge > 0 && (
                        <span
                          className={`text-[11px] font-semibold min-w-[18px] h-[18px] flex items-center
                            justify-center rounded-full px-1
                            ${active ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* System group */}
            <div>
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                System
              </p>
              <div className="space-y-0.5">
                {systemNav.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                        transition-colors duration-150
                        ${active
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 leading-none">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>

          {/* Sign out at bottom */}
          <div className="p-3 border-t border-slate-100">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                         text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors duration-150"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* ── MAIN CONTENT ─────────────────────────────────── */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
