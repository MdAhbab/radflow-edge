import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import {
  HeartPulse,
  MapPin,
  PhoneCall,
  ShieldCheck,
  Activity,
  BrainCircuit,
  ChevronRight,
  Stethoscope,
  Mail,
  Lock,
  User as UserIcon,
  Building2,
  BadgeCheck,
  Wifi,
  ArrowRight,
  Layers,
  ScanLine,
  ExternalLink,
  Upload,
  Crosshair,
  Crop,
  FileText,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

/* ─────────────────────────────────────────────────────────
   SCROLL REVEAL – smooth cubic-bezier ease-out
───────────────────────────────────────────────────────── */
function useReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({ children, delay = 0, className = "" }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  const { ref, visible } = useReveal();
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(14px)",
      transition: `opacity 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

/* Fade-in on mount with custom delay */
function FadeIn({ children, delay = 0, className = "" }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), delay + 80); return () => clearTimeout(t); }, [delay]);
  return (
    <div className={className} style={{
      opacity: show ? 1 : 0,
      transform: show ? "translateY(0)" : "translateY(16px)",
      transition: "opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)",
    }}>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   STAT COUNTER  – animated number on mount
───────────────────────────────────────────────────────── */
function StatCounter({
  value,
  suffix = "",
  prefix = "",
}: {
  value: number;
  suffix?: string;
  prefix?: string;
}) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    // requestAnimationFrame keeps the count-up off the timer queue and
    // naturally pauses when the tab is hidden.
    const duration = 1200;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setCount(Math.round(value * progress));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span>{prefix}{count.toLocaleString()}{suffix}</span>;
}

/* ─────────────────────────────────────────────────────────
   CAPABILITY ROW  – minimal, single accent
───────────────────────────────────────────────────────── */
interface FeatureCardProps {
  index: string; icon: React.ReactNode; title: string;
  description: string; metric: string; metricLabel: string;
  accent: string; accentText: string; accentBg: string;
}

/* ─────────────────────────────────────────────────────────
   PIPELINE STEP  – numbered horizontal node
───────────────────────────────────────────────────────── */
interface PipelineStepProps {
  number: number; icon: React.ReactNode; title: string;
  body: string; isLast?: boolean; accentBg: string; accentText: string;
}
function PipelineStep({ number, icon, title, body, isLast }: PipelineStepProps) {
  return (
    <div className="flex flex-col items-center text-center relative flex-1 min-w-0 group">
      {!isLast && (
        <div className="absolute top-5 left-[calc(50%+20px)] right-0 h-px bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 z-0" />
      )}
      <div className="relative z-10 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-900 border border-slate-800
                        group-hover:border-blue-500/40 group-hover:bg-slate-800/80 transition-all duration-300">
          <div className="h-4 w-4 text-slate-400 group-hover:text-blue-400 transition-colors duration-300">{icon}</div>
        </div>
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-950 border border-slate-800
                         flex items-center justify-center text-[9px] font-bold text-slate-500">{number}</span>
      </div>
      <p className="text-xs font-semibold text-slate-300 mb-1 leading-snug group-hover:text-white transition-colors duration-200">{title}</p>
      <p className="text-[10px] text-slate-600 leading-relaxed px-1 group-hover:text-slate-500 transition-colors duration-200">{body}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   INPUT WITH LEADING ICON
───────────────────────────────────────────────────────── */
function IconInput({
  id, type = "text", placeholder, value, onChange, icon, required,
}: {
  id: string; type?: string; placeholder: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon: React.ReactNode; required?: boolean;
}) {
  return (
    <div className="relative">
      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">{icon}</div>
      <Input
        id={id} type={type} placeholder={placeholder} required={required} value={value} onChange={onChange}
        className="pl-10 h-11 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400
                   focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-400
                   transition-colors rounded-xl text-sm"
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   MAIN WELCOME COMPONENT
───────────────────────────────────────────────────────── */
export function Welcome() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    fullName: "", email: "", password: "", age: "", gender: "", profession: "", institute: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData({ ...formData, [e.target.id]: e.target.value });

  const handleSelectChange = (id: string, value: string) =>
    setFormData({ ...formData, [id]: value });

  useEffect(() => {
    const panel = document.getElementById("landing-scroll-area");
    if (!panel) return;
    const handler = () => setScrolled(panel.scrollTop > 60);
    panel.addEventListener("scroll", handler);
    return () => panel.removeEventListener("scroll", handler);
  }, []);

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLogin) {
      localStorage.setItem("hsil_user_name", formData.fullName);
      localStorage.setItem("hsil_user_institute", formData.institute);
      localStorage.setItem("hsil_user_profession", formData.profession);
    } else {
      // Local-only demo session: derive a display name from the email
      // instead of pretending a real account was looked up.
      const emailName = formData.email.split("@")[0].replace(/[._-]+/g, " ").trim();
      const displayName = emailName
        ? emailName.replace(/\b\w/g, (c) => c.toUpperCase())
        : "Clinical User";
      localStorage.setItem("hsil_user_name", displayName);
      localStorage.setItem("hsil_user_institute", "District Hospital");
      localStorage.setItem("hsil_user_profession", "clinical_staff");
    }
    navigate("/dashboard");
  };

  const features: FeatureCardProps[] = [
    {
      index: "01", icon: <BrainCircuit className="h-4 w-4" />,
      title: "Offline-First Edge AI",
      description: "DICOM-grade models run entirely on local hardware — no internet required.",
      metric: "< 2s", metricLabel: "avg inference",
      accent: "bg-blue-500", accentText: "text-blue-400", accentBg: "bg-blue-500/10",
    },
    {
      index: "02", icon: <ScanLine className="h-4 w-4" />,
      title: "TB & Pathology Detection",
      description: "Detects TB, pleural effusion, cardiomegaly and 12 other conditions.",
      metric: "99.1%", metricLabel: "TB sensitivity",
      accent: "bg-blue-500", accentText: "text-blue-400", accentBg: "bg-blue-500/10",
    },
    {
      index: "03", icon: <Layers className="h-4 w-4" />,
      title: "Smart Triage Queue",
      description: "AI prioritises cases by severity so critical findings surface first.",
      metric: "Auto", metricLabel: "escalation",
      accent: "bg-blue-500", accentText: "text-blue-400", accentBg: "bg-blue-500/10",
    },
    {
      index: "04", icon: <Wifi className="h-4 w-4" />,
      title: "Sync on Reconnect",
      description: "Flagged cases sync securely to remote specialists when connectivity returns.",
      metric: "E2E", metricLabel: "encrypted",
      accent: "bg-blue-500", accentText: "text-blue-400", accentBg: "bg-blue-500/10",
    },
  ];

  const pipelineSteps: PipelineStepProps[] = [
    {
      number: 1, icon: <Upload className="h-6 w-6" />,
      title: "Upload X-Ray / DICOM",
      body: "Nurse uploads PNG or DICOM file up to 20 MB via local interface or USB transfer.",
      accentBg: "bg-slate-800", accentText: "text-blue-400",
    },
    {
      number: 2, icon: <BrainCircuit className="h-6 w-6" />,
      title: "CNN Scan",
      body: "DenseNet121 scans the full image. No cloud, no token limit — runs entirely on-device.",
      accentBg: "bg-slate-800", accentText: "text-violet-400",
    },
    {
      number: 3, icon: <Crosshair className="h-6 w-6" />,
      title: "GradCAM Localise",
      body: "Gradient-weighted activation maps pinpoint the exact region of clinical interest.",
      accentBg: "bg-slate-800", accentText: "text-amber-400",
    },
    {
      number: 4, icon: <Crop className="h-6 w-6" />,
      title: "Smart Crop",
      body: "Only the abnormal region is extracted and passed forward, reducing LLM token cost.",
      accentBg: "bg-slate-800", accentText: "text-emerald-400",
    },
    {
      number: 5, icon: <FileText className="h-6 w-6" />,
      title: "LLM Report",
      body: "CheXagent generates a structured clinical finding report ready for the physician.",
      accentBg: "bg-slate-800", accentText: "text-teal-400",
      isLast: true,
    },
  ];

  return (
    <div
      className="flex h-screen w-full overflow-hidden bg-slate-950"
      style={{ fontFamily: "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      {/* ── LEFT PANEL ──────────────────────────────────────────── */}
      <div
        id="landing-scroll-area"
        className="w-[60%] h-full overflow-y-auto overflow-x-hidden relative scroll-smooth"
        style={{ scrollbarWidth: "none" }}
      >
        {/* ── HEADER ────────────────────────────────────────────── */}
        <header className={`fixed top-0 left-0 w-[60%] z-50 transition-all duration-500
          ${scrolled ? "bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/40 py-3" : "bg-transparent py-4"}`}
        >
          <div className="px-12 flex items-center justify-between">
            <a href="#" className="flex items-center gap-2 group">
              <div className="relative">
                <Activity className="h-5 w-5 text-blue-400 group-hover:text-blue-300 transition-colors duration-200" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              </div>
              <span className="font-bold text-white tracking-tight text-lg" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                RadFlow<span className="text-blue-400">-Edge</span>
              </span>
            </a>
            <nav className="flex items-center gap-8">
              {[
                { href: "#about", label: "About" },
                { href: "#features", label: "Features" },
                { href: "#pipeline", label: "Pipeline" },
                { href: "#nearby", label: "Resources", icon: <MapPin className="h-4 w-4" /> },
              ].map(({ href, label, icon }) => (
                <a key={href} href={href}
                  className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-200
                             transition-colors duration-200 relative group font-medium"
                >
                  {icon}{label}
                  <span className="absolute -bottom-0.5 left-0 right-0 h-px bg-blue-500/70 scale-x-0
                                   group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-full" />
                </a>
              ))}
            </nav>
          </div>
        </header>

        {/* ── HERO ──────────────────────────────────────────────── */}
        <section className="relative h-screen flex flex-col justify-between px-12 pt-20 pb-10 overflow-hidden">
          <div className="absolute inset-0 -z-20">
            <video
              src="/hero.mp4"
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              className="w-full h-full object-cover opacity-60"
              style={{ filter: "saturate(0.8) contrast(1.2)" }}
            />
          </div>
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-950/80 via-slate-950/40 to-slate-950" />

          {/* Content */}
          <div className="flex flex-col justify-center flex-1 gap-5">
            <FadeIn delay={0}>
              <h1 className="text-4xl xl:text-[3rem] font-extrabold text-white tracking-tighter leading-[1.1] drop-shadow-lg"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Expert Radiology<br />
                <span className="text-blue-400">at the Last Mile.</span>
              </h1>
            </FadeIn>

            <FadeIn delay={120}>
              <p className="text-sm text-slate-400 max-w-md leading-relaxed">
                Specialist-grade imaging intelligence for district hospitals across Bangladesh —
                operating entirely offline, triaging critical cases in under two seconds.
              </p>
            </FadeIn>

            <FadeIn delay={220}>
              <div className="flex items-center gap-5">
                <a href="#features">
                  <Button className="bg-blue-600 hover:bg-blue-500 text-white h-9 px-5 rounded-lg
                                     font-medium text-sm transition-all duration-200 hover:-translate-y-px
                                     shadow-md shadow-blue-900/20 hover:shadow-blue-800/30">
                    See How It Works
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform duration-200" />
                  </Button>
                </a>
                <a href="#about"
                  className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300
                             transition-colors duration-200 group">
                  About the Project
                  <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform duration-200" />
                </a>
              </div>
            </FadeIn>
          </div>

          {/* Stats — bottom */}
          <FadeIn delay={360}>
            <div className="grid grid-cols-4 gap-6 pt-6 border-t border-slate-800/50">
              {[
                { value: 64, suffix: "",  label: "Districts Covered", prefix: "" },
                { value: 2,  suffix: "s", label: "Avg. Inference",    prefix: "<" },
                { value: 14, suffix: "+", label: "Conditions Detected", prefix: "" },
                { value: 99, suffix: "%", label: "TB Sensitivity",    prefix: "" },
              ].map(({ value, suffix, label, prefix }) => (
                <div key={label}>
                  <div className="text-lg font-bold text-white tracking-tight tabular-nums">
                    <StatCounter value={value} suffix={suffix} prefix={prefix} />
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </FadeIn>
        </section>

        {/* ── CAPABILITIES ──────────────────────────────────────── */}
        <section id="features" className="bg-slate-950 px-12 py-16">
          <Reveal>
            <div className="flex items-center gap-4 mb-3">
              <span className="text-xs font-bold tracking-[0.2em] text-blue-400/90 uppercase">Capabilities</span>
              <span className="flex-1 h-px bg-slate-800/70" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-12 tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Built for the clinic floor.{" "}
              <span className="text-slate-500 font-medium">Not the conference room.</span>
            </h2>
          </Reveal>

          <div className="grid grid-cols-2 gap-6">
            {features.map((f, i) => (
              <Reveal key={f.index} delay={i * 60}>
                <div className="group flex items-start gap-4 p-5 rounded-2xl bg-slate-900/40 backdrop-blur-md border border-slate-800/50
                                hover:bg-slate-800/60 hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] transition-all duration-300 cursor-default">
                  <div className="mt-0.5 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 shrink-0
                                  group-hover:bg-blue-500/20 group-hover:border-blue-500/30 transition-all duration-300">
                    <div className="h-4 w-4 text-blue-400">{f.icon}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-base font-semibold text-slate-100 leading-snug">{f.title}</p>
                      <span className="text-xs font-bold text-blue-400/90 bg-blue-500/10 px-2 py-0.5 rounded-md shrink-0">
                        {f.metric}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed font-medium">{f.description}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── PIPELINE ──────────────────────────────────────────── */}
        <section id="pipeline" className="bg-[#05080f] px-12 py-16 border-t border-slate-800/60">
          <Reveal>
            <div className="flex items-center gap-4 mb-3">
              <span className="text-xs font-bold tracking-[0.2em] text-slate-400 uppercase">AI Pipeline</span>
              <span className="flex-1 h-px bg-slate-800/70" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-16 tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Raw image to structured report.{" "}
              <span className="text-slate-500 font-medium">Fully automated.</span>
            </h2>
          </Reveal>

          <Reveal delay={80}>
            <div className="flex items-start gap-0">
              {pipelineSteps.map((step, i) => (
                <PipelineStep key={step.number} {...step} isLast={i === pipelineSteps.length - 1} />
              ))}
            </div>
            <div className="mt-12 flex items-center justify-center gap-4">
              {["Runs on-device", "No PHI leaves the facility", "< 30s end-to-end"].map((t, i) => (
                <React.Fragment key={t}>
                  {i > 0 && <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />}
                  <span className="text-sm font-medium text-slate-500 tracking-wide">{t}</span>
                </React.Fragment>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ── FOOTER ────────────────────────────────────────────── */}
        <footer id="about" className="bg-slate-950 border-t border-slate-800/60 px-12 pt-16 pb-12">
          <Reveal>
            <div className="grid grid-cols-3 gap-12 mb-12">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-500" />
                  <span className="font-bold text-slate-200 text-base tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    RadFlow-Edge
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed max-w-xs font-medium">
                  HSIL Hackathon 2026 — improving radiology access across rural Bangladesh.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                  <span className="text-xs font-medium text-slate-400">System Operational</span>
                </div>
              </div>

              <div id="nearby" className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">Resources</h4>
                <ul className="space-y-3">
                  {[
                    { label: "DGHS Bangladesh", href: "https://dghs.gov.bd/" },
                    { label: "WHO Bangladesh",  href: "https://www.who.int/bangladesh" },
                    { label: "icddr,b Research", href: "https://www.icddrb.org/" },
                  ].map(({ label, href }) => (
                    <li key={label}>
                      <a href={href} target="_blank" rel="noopener noreferrer"
                        className="group flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors duration-200">
                        {label}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity duration-200" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">Emergency</h4>
                <ul className="space-y-3">
                  {[
                    { label: "National Emergency", number: "999", icon: <PhoneCall className="h-3.5 w-3.5 text-slate-500" /> },
                    { label: "Shastho Batayon",    number: "16263", icon: <HeartPulse className="h-3.5 w-3.5 text-slate-500" /> },
                  ].map(({ label, number, icon }) => (
                    <li key={label} className="flex items-center gap-2.5">
                      {icon}
                      <span className="text-xs font-medium text-slate-500">{label}</span>
                      <span className="text-xs font-bold text-slate-300 ml-auto">{number}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-8 border-t border-slate-800/60 flex items-center justify-between">
              <p className="text-xs font-medium text-slate-600">&copy; 2026 RadFlow-Edge. All rights reserved.</p>
              <div className="flex items-center gap-6">
                {["Terms", "Privacy", "Agreement"].map(t => (
                  <a key={t} href="#"
                    className="text-xs font-medium text-slate-600 hover:text-slate-400 transition-colors duration-200">{t}</a>
                ))}
              </div>
            </div>
          </Reveal>
        </footer>
      </div>

      {/* ── RIGHT PANEL – AUTH ──────────────────────────────────── */}
      <div className="w-[40%] shrink-0 h-full flex flex-col bg-white relative overflow-hidden shadow-[-24px_0_48px_-12px_rgba(0,0,0,0.4)] z-20">
        <div className="flex-1 overflow-y-auto flex flex-col justify-center px-10 py-8 relative z-10">
          <div className="max-w-[320px] w-full mx-auto">

            {/* Brand mark */}
            <div className="flex items-center gap-2 mb-6">
              <div className="p-1.5 bg-blue-600 rounded-lg">
                <Activity className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-bold text-slate-800 tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                RadFlow-Edge
              </span>
            </div>

            {/* Auth header */}
            <div className="mb-5">
              <div className="inline-flex items-center gap-1.5 bg-slate-100 rounded-full px-3 py-1.5 mb-3">
                <Stethoscope className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-xs font-semibold text-slate-600 tracking-wide">Clinical Portal</span>
              </div>
              <h2
                className="text-2xl font-bold text-slate-900 tracking-tight leading-tight whitespace-pre-line"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {isLogin ? "Sign in to your\nclinical workspace." : "Join the\nclinical network."}
              </h2>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                {isLogin
                  ? "Access your AI-assisted radiology dashboard."
                  : "Create an account as a verified healthcare professional."}
              </p>
            </div>

            {/* Toggle tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl mb-5 gap-1">
              {[{ id: true, label: "Sign In" }, { id: false, label: "Register" }].map(({ id, label }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setIsLogin(id)}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200
                    ${isLogin === id ? "bg-white text-slate-900 shadow-sm shadow-slate-200/80" : "text-slate-500 hover:text-slate-700"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Full Name</Label>
                    <IconInput
                      id="fullName" placeholder="Full name"
                      value={formData.fullName} onChange={handleInputChange}
                      icon={<UserIcon className="h-4 w-4" />} required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="age" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Age</Label>
                      <Input
                        id="age" type="number" min="18" max="100" placeholder="35" required
                        value={formData.age} onChange={handleInputChange}
                        className="h-11 bg-slate-50 border-slate-200 text-slate-900 rounded-xl text-sm
                                   focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Gender</Label>
                      <Select onValueChange={(v) => handleSelectChange("gender", v)} required>
                        <SelectTrigger className="h-11 bg-slate-50 border-slate-200 text-slate-900 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/40">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent className="z-[100] rounded-xl">
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Clinical Role</Label>
                    <Select onValueChange={(v) => handleSelectChange("profession", v)} required>
                      <SelectTrigger className="h-11 bg-slate-50 border-slate-200 text-slate-900 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/40">
                        <SelectValue placeholder="Select your role" />
                      </SelectTrigger>
                      <SelectContent className="z-[100] rounded-xl">
                        {[
                          { value: "physician",   label: "General Physician" },
                          { value: "specialist",  label: "Specialist / Consultant" },
                          { value: "nurse",       label: "Clinical Nurse" },
                          { value: "technician",  label: "Radiology Technician" },
                          { value: "admin",       label: "Admin / Management" },
                        ].map(({ value, label }) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="institute" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Hospital / Institute</Label>
                    <IconInput
                      id="institute" placeholder="Hospital or clinic name"
                      value={formData.institute} onChange={handleInputChange}
                      icon={<Building2 className="h-4 w-4" />} required
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Email Address</Label>
                <IconInput
                  id="email" type="email" placeholder="Enter your email address"
                  value={formData.email} onChange={handleInputChange}
                  icon={<Mail className="h-4 w-4" />} required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Password</Label>
                  {isLogin && (
                    <a href="#" className="text-xs font-semibold text-blue-600 hover:text-blue-500 transition-colors">
                      Forgot password?
                    </a>
                  )}
                </div>
                <IconInput
                  id="password" type="password" placeholder="••••••••••"
                  value={formData.password} onChange={handleInputChange}
                  icon={<Lock className="h-4 w-4" />} required
                />
              </div>

              {/* Terms notice on register */}
              {!isLogin && (
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  By registering you agree to our{" "}
                  <a href="#" className="text-blue-600 hover:underline">Terms &amp; Conditions</a>
                  {" "}and{" "}
                  <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a>.
                </p>
              )}

              <Button
                type="submit"
                className="w-full h-11 mt-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold
                           text-sm rounded-xl shadow-lg shadow-blue-600/25 transition-all duration-200
                           hover:shadow-blue-500/30 hover:-translate-y-0.5 active:translate-y-0"
              >
                {isLogin ? "Sign In to Dashboard" : "Create Clinical Account"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs text-slate-400">
                  {isLogin ? "New to RadFlow-Edge?" : "Already registered?"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="w-full text-center text-sm font-semibold text-blue-600 hover:text-blue-500
                         transition-colors duration-150 py-2 rounded-xl hover:bg-blue-50"
            >
              {isLogin ? "Create a clinical account" : "Sign in to your account"}
            </button>

            {/* Trust footer */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-center gap-4">
                {[
                  { icon: <ShieldCheck className="h-3.5 w-3.5" />, label: "Secure Gateway" },
                  { icon: <BadgeCheck className="h-3.5 w-3.5" />,  label: "Verified Access" },
                ].map(({ icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-slate-400">
                    {icon}
                    <span className="text-[11px] font-medium">{label}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
