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
  BarChart3,
  ExternalLink,
  Zap,
  Globe,
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
import { api, SystemStatus } from "../../../api";
 

/* ─────────────────────────────────────────────────────────
   SCROLL REVEAL HOOK  – IntersectionObserver, no spring
───────────────────────────────────────────────────────── */
function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/* Wrapper that fades + lifts in when scrolled into view */
function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(18px)",
        transition: `opacity 0.55s ease ${delay}ms, transform 0.55s ease ${delay}ms`,
      }}
    >
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
    let start = 0;
    const step = Math.ceil(value / (1800 / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setCount(value); clearInterval(timer); }
      else setCount(start);
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{prefix}{count.toLocaleString()}{suffix}</span>;
}

/* ─────────────────────────────────────────────────────────
   FEATURE CARD
───────────────────────────────────────────────────────── */
interface FeatureCardProps {
  index: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  metric: string;
  metricLabel: string;
  accent: string;
  accentText: string;
  accentBg: string;
}
function FeatureCard({ index, icon, title, description, metric, metricLabel, accent, accentText, accentBg }: FeatureCardProps) {
  return (
    <div
      className="group relative bg-slate-900/60 border border-slate-700/40 rounded-2xl p-7 backdrop-blur-sm
                 hover:border-slate-600/60 hover:-translate-y-1 transition-all duration-300
                 hover:shadow-2xl hover:bg-slate-800/60"
    >
      <span className="absolute top-6 right-7 text-[10px] font-mono tracking-widest text-slate-600 uppercase">{index}</span>
      <div className={`inline-flex p-3 rounded-xl mb-5 ${accentBg}`}>
        <div className={`h-5 w-5 ${accentText}`}>{icon}</div>
      </div>
      <h3 className="text-base font-semibold text-white mb-2 leading-snug">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed mb-6">{description}</p>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${accentBg} ${accentText}`}>{metric}</span>
        <span className="text-xs text-slate-500">{metricLabel}</span>
      </div>
      <div className={`absolute bottom-0 left-6 right-6 h-px ${accent} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full`} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   PIPELINE STEP
───────────────────────────────────────────────────────── */
interface PipelineStepProps {
  number: number;
  icon: React.ReactNode;
  title: string;
  body: string;
  isLast?: boolean;
  accentBg: string;
  accentText: string;
}
function PipelineStep({ number, icon, title, body, isLast, accentBg, accentText }: PipelineStepProps) {
  return (
    <div className="flex flex-col items-center text-center relative flex-1 min-w-0">
      {/* Connector line */}
      {!isLast && (
        <div className="absolute top-[28px] left-[calc(50%+28px)] right-0 h-px bg-gradient-to-r from-slate-600/60 to-slate-700/30 z-0" />
      )}

      {/* Icon box with number badge */}
      <div className="relative z-10 mb-4">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${accentBg} border border-slate-700/40`}>
          <div className={`h-6 w-6 ${accentText}`}>{icon}</div>
        </div>
        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-800 border border-slate-700
                         flex items-center justify-center text-[10px] font-bold text-slate-300">
          {number}
        </span>
      </div>

      {/* Text */}
      <p className="text-sm font-semibold text-white mb-1.5 leading-snug">{title}</p>
      <p className="text-xs text-slate-500 leading-relaxed px-2">{body}</p>
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
  const [mission, setMission] = useState<SystemStatus | null>(null);
  
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

  useEffect(() => {
    const loadMission = async () => {
      try {
        const status = await api.getSystemStatus();
        setMission(status);
      } catch {
        setMission(null);
      }
    };
    loadMission();
  }, []);

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLogin) {
      localStorage.setItem("hsil_user_name", formData.fullName);
      localStorage.setItem("hsil_user_institute", formData.institute);
      localStorage.setItem("hsil_user_profession", formData.profession);
    } else {
      localStorage.setItem("hsil_user_name", "Dr. Ahbab");
      localStorage.setItem("hsil_user_institute", "Dhaka Medical College");
      localStorage.setItem("hsil_user_profession", "specialist");
    }
    navigate("/dashboard");
  };

  const features: FeatureCardProps[] = [
    {
      index: "01", icon: <BrainCircuit className="h-5 w-5" />,
      title: "Offline-First Edge AI",
      description: "Run DICOM-grade radiology models entirely on local hardware. No internet dependency for anomaly detection — designed for zero-connectivity environments.",
      metric: "< 2s", metricLabel: "average inference time",
      accent: "bg-blue-500", accentText: "text-blue-400", accentBg: "bg-blue-500/10",
    },
    {
      index: "02", icon: <ScanLine className="h-5 w-5" />,
      title: "TB & Pathology Detection",
      description: "Trained on Bangladeshi patient cohorts. Detects tuberculosis, pleural effusion, cardiomegaly and 12 other conditions with specialist-level sensitivity.",
      metric: "99.1%", metricLabel: "TB detection sensitivity",
      accent: "bg-emerald-500", accentText: "text-emerald-400", accentBg: "bg-emerald-500/10",
    },
    {
      index: "03", icon: <Layers className="h-5 w-5" />,
      title: "Smart Triage Queue",
      description: "AI automatically ranks incoming cases by severity. Critical findings surface first — giving clinicians a prioritized, actionable worklist every shift.",
      metric: "Auto", metricLabel: "priority escalation",
      accent: "bg-violet-500", accentText: "text-violet-400", accentBg: "bg-violet-500/10",
    },
    {
      index: "04", icon: <Wifi className="h-5 w-5" />,
      title: "Sync on Reconnect",
      description: "When internet resumes, flagged cases are securely pushed to remote specialists. Full clinical context, AI findings, and images in one structured handoff.",
      metric: "E2E", metricLabel: "encrypted sync",
      accent: "bg-teal-500", accentText: "text-teal-400", accentBg: "bg-teal-500/10",
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
        className="flex-1 h-full overflow-y-auto overflow-x-hidden relative scroll-smooth"
      >
        {/* ── HEADER ────────────────────────────────────────────── */}
        <header
          className={`fixed top-0 left-0 w-[calc(100%-380px)] z-50 transition-all duration-500
            ${scrolled
              ? "bg-slate-950/92 backdrop-blur-xl border-b border-slate-800/60 py-3.5"
              : "bg-transparent py-5"
            }`}
        >
          <div className="max-w-3xl mx-auto px-10 flex items-center justify-between">
            <a href="#" className="flex items-center gap-2.5">
              <div className="relative">
                <Activity className="h-5 w-5 text-blue-400" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              </div>
              <span className="font-bold text-white tracking-tight text-base" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                RadFlow<span className="text-blue-400">-Edge</span>
              </span>
            </a>

            <nav className="flex items-center gap-7">
              {[
                { href: "#about", label: "About" },
                { href: "#services", label: "Features" },
                { href: "#pipeline", label: "Pipeline" },
                { href: "#nearby", label: "Resources", icon: <MapPin className="h-3.5 w-3.5" /> },
              ].map(({ href, label, icon }) => (
                <a
                  key={href}
                  href={href}
                  className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white
                             transition-colors duration-200 relative group font-medium"
                >
                  {icon}
                  {label}
                  <span className="absolute -bottom-0.5 left-0 right-0 h-px bg-blue-500 scale-x-0
                                   group-hover:scale-x-100 transition-transform duration-200 origin-left rounded-full" />
                </a>
              ))}
            </nav>
          </div>
        </header>

        {/* ── HERO ──────────────────────────────────────────────── */}
        <section className="relative h-screen min-h-[600px] max-h-[960px] flex flex-col justify-center px-10 overflow-hidden">
          {/* Background image */}
          <div
            className="absolute inset-0 -z-20 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: "url('https://images.unsplash.com/photo-1758574437870-f83c160efd82?fm=jpg&q=85&w=2400&auto=format&fit=crop')",
              filter: "brightness(0.28) saturate(0.7)",
            }}
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-950 via-slate-950/70 to-transparent" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />

          {/* Hero content */}
          <div className="max-w-3xl w-full">
            {/* Badge */}
            <div className="flex items-center gap-3 mb-8">
              <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest
                               text-blue-400 uppercase bg-blue-500/10 border border-blue-500/20
                               px-4 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                AI-Powered Clinical Triage · HSIL Hackathon 2026
              </span>
            </div>

            <h1
              className="text-5xl xl:text-6xl font-extrabold text-white tracking-tight leading-[1.1] mb-6"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Expert Radiology
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-teal-400 to-emerald-400">
                at the Last Mile.
              </span>
            </h1>

            <p className="text-lg text-slate-400 max-w-xl leading-relaxed mb-10 font-light">
              RadFlow-Edge brings specialist-grade imaging intelligence to district hospitals
              across Bangladesh — operating entirely offline, triaging critical cases in under
              two seconds.
            </p>

            <div className="flex items-center gap-4">
              <a href="#features">
                <Button
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-500 text-white h-12 px-7 rounded-xl
                             font-semibold shadow-lg shadow-blue-900/30 transition-all duration-200
                             hover:shadow-blue-800/40 hover:-translate-y-0.5 text-sm"
                >
                  See How It Works
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
              <a href="#about" className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors duration-200">
                About the Project
                <ChevronRight className="h-4 w-4" />
              </a>
            </div>

            {/* Stats row */}
            <div className="mt-14 pt-10 border-t border-slate-800/60 grid grid-cols-4 gap-6">
              {[
                { value: 64, suffix: "",  label: "Districts Covered",  prefix: "" },
                { value: 2,  suffix: "s", label: "Avg. AI Inference",  prefix: "<" },
                { value: 14, suffix: "+", label: "Detectable Conditions", prefix: "" },
                { value: 99, suffix: "%", label: "TB Sensitivity",     prefix: "" },
              ].map(({ value, suffix, label, prefix }) => (
                <div key={label} className="space-y-1">
                  <div className="text-2xl font-bold text-white tracking-tight">
                    <StatCounter value={value} suffix={suffix} prefix={prefix} />
                  </div>
                  <div className="text-xs text-slate-500 font-medium">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES GRID ─────────────────────────────────────── */}
        <section id="features" className="bg-slate-950 py-20 px-10 border-t border-slate-800/50">
          <div className="max-w-3xl mx-auto">
            <Reveal className="mb-12">
              <p className="text-xs font-semibold tracking-widest text-blue-400 uppercase mb-3">Core Capabilities</p>
              <h2
                className="text-3xl font-bold text-white tracking-tight"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Built for the Clinic Floor.
                <br />
                <span className="text-slate-400 font-normal">Not the conference room.</span>
              </h2>
            </Reveal>

            <div className="grid grid-cols-2 gap-5">
              {features.map((f, i) => (
                <Reveal key={f.index} delay={i * 70}>
                  <FeatureCard {...f} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── PIPELINE VISUALIZATION ────────────────────────────── */}
        <section id="pipeline" className="bg-[#060b14] py-20 px-10 border-t border-slate-800/50">
          <div className="max-w-3xl mx-auto">
            <Reveal className="text-center mb-14">
              <p className="text-xs font-semibold tracking-widest text-teal-400 uppercase mb-3">
                AI Processing Pipeline
              </p>
              <h2
                className="text-2xl font-bold text-white tracking-tight"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                From raw image to structured report
                <br />
                <span className="text-slate-400 font-normal">in a single automated pipeline.</span>
              </h2>
            </Reveal>

            <Reveal delay={80}>
              {/* Step row */}
              <div className="flex items-start gap-0">
                {pipelineSteps.map((step, i) => (
                  <PipelineStep key={step.number} {...step} isLast={i === pipelineSteps.length - 1} />
                ))}
              </div>

              {/* Thin baseline rule under steps */}
              <div className="mt-10 pt-6 border-t border-slate-800/40 flex items-center justify-center gap-2">
                <span className="text-xs text-slate-600">Entire pipeline runs on-device</span>
                <span className="text-slate-700">·</span>
                <span className="text-xs text-slate-600">No PHI leaves the facility</span>
                <span className="text-slate-700">·</span>
                <span className="text-xs text-slate-600">Average end-to-end: &lt; 30s</span>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── TRUST STRIP ───────────────────────────────────────── */}
        <section className="bg-slate-900/40 border-y border-slate-800/50 py-10 px-10">
          <Reveal>
            <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
              {[
                { icon: <ShieldCheck className="h-4 w-4" />, label: "DICOM 3.0 Compliant" },
                { icon: <Globe className="h-4 w-4" />,       label: "Bangladesh MoHFW Guidelines" },
                { icon: <Zap className="h-4 w-4" />,         label: "Offline-First Architecture" },
                { icon: <BarChart3 className="h-4 w-4" />,   label: "Retrospectively Validated" },
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-2.5 text-slate-400">
                  <span className="text-slate-500">{icon}</span>
                  <span className="text-xs font-medium">{label}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ── FOOTER ────────────────────────────────────────────── */}
        <footer id="about" className="bg-slate-950 border-t border-slate-800/60 pt-16 pb-10 px-10">
          <div className="max-w-3xl mx-auto">
            <Reveal>
              <div className="grid grid-cols-3 gap-10 mb-12">
                {/* Brand */}
                <div className="col-span-1 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <Activity className="h-4 w-4 text-blue-400" />
                    <span className="font-bold text-white text-sm tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      RadFlow-Edge
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Submitted for the HSIL Hackathon 2026.
                    <br />
                    Improving radiology access across rural Bangladesh.
                  </p>
                  <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-500 gap-1.5 w-fit">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    System Operational
                  </Badge>
                </div>

                {/* Resources */}
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Resources</h4>
                  <ul className="space-y-2.5">
                    {[
                      { label: "DGHS Bangladesh",  href: "https://dghs.gov.bd/" },
                      { label: "WHO Bangladesh",   href: "https://www.who.int/bangladesh" },
                      { label: "icddr,b Research", href: "https://www.icddrb.org/" },
                    ].map(({ label, href }) => (
                      <li key={label}>
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors duration-150 group"
                        >
                          {label}
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Emergency */}
                <div id="nearby" className="space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Emergency Lines</h4>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-red-500/10">
                        <PhoneCall className="h-3.5 w-3.5 text-red-400" />
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide">National Emergency</div>
                        <div className="text-lg font-bold text-red-400 leading-tight tracking-tight">999</div>
                      </div>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-blue-500/10">
                        <HeartPulse className="h-3.5 w-3.5 text-blue-400" />
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide">Shastho Batayon</div>
                        <div className="text-lg font-bold text-blue-400 leading-tight tracking-tight">16263</div>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Bottom bar */}
              <div className="pt-8 border-t border-slate-800/60 flex items-center justify-between gap-4">
                <p className="text-xs text-slate-600">
                  &copy; 2026 RadFlow-Edge. All rights reserved.
                </p>
                <div className="flex items-center gap-5">
                  <a href="#" className="text-xs text-slate-600 hover:text-slate-400 transition-colors duration-150">
                    Terms &amp; Conditions
                  </a>
                  <a href="#" className="text-xs text-slate-600 hover:text-slate-400 transition-colors duration-150">
                    Privacy Policy
                  </a>
                  <a href="#" className="text-xs text-slate-600 hover:text-slate-400 transition-colors duration-150">
                    User Agreement
                  </a>
                </div>
              </div>
            </Reveal>
          </div>
        </footer>
      </div>

      {/* ── RIGHT PANEL – AUTH ──────────────────────────────────── */}
      <div className="w-[380px] shrink-0 h-full flex flex-col bg-white relative overflow-hidden shadow-[-24px_0_48px_-12px_rgba(0,0,0,0.4)] z-20">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-100 rounded-full blur-3xl opacity-40 pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-56 h-56 bg-teal-100 rounded-full blur-3xl opacity-30 pointer-events-none" />

        <div className="flex-1 overflow-y-auto px-10 py-12 relative z-10">
          <div className="max-w-[320px] mx-auto">

            {/* Brand mark */}
            <div className="flex items-center gap-2 mb-10">
              <div className="p-1.5 bg-blue-600 rounded-lg">
                <Activity className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-bold text-slate-800 tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                RadFlow-Edge
              </span>
            </div>

            {/* Auth header */}
            <div className="mb-8">
              <div className="inline-flex items-center gap-1.5 bg-slate-100 rounded-full px-3 py-1.5 mb-4">
                <Stethoscope className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-xs font-semibold text-slate-600 tracking-wide">Clinical Portal</span>
              </div>
              <h2
                className="text-2xl font-bold text-slate-900 tracking-tight leading-tight"
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
            <div className="flex bg-slate-100 p-1 rounded-xl mb-7 gap-1">
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
            <div className="relative my-6">
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
            <div className="mt-8 pt-6 border-t border-slate-100">
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
