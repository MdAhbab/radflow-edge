import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { 
  HeartPulse, 
  MapPin, 
  PhoneCall, 
  ShieldCheck, 
  Activity, 
  BrainCircuit, 
  Users,
  ChevronRight,
  Stethoscope
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Separator } from "../ui/separator";
import { api, SystemStatus } from "../../../api";

export function Welcome() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [mission, setMission] = useState<SystemStatus | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    age: "",
    gender: "",
    profession: "",
    institute: ""
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSelectChange = (id: string, value: string) => {
    setFormData({ ...formData, [id]: value });
  };

  useEffect(() => {
    const handleScroll = () => {
      // Find the scrollable container (left side)
      const leftPanel = document.getElementById("landing-scroll-area");
      if (leftPanel && leftPanel.scrollTop > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    const leftPanel = document.getElementById("landing-scroll-area");
    if (leftPanel) {
      leftPanel.addEventListener("scroll", handleScroll);
      return () => leftPanel.removeEventListener("scroll", handleScroll);
    }
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
    
    // Persist data for the session (mocking auth)
    if (!isLogin) {
      localStorage.setItem("hsil_user_name", formData.fullName);
      localStorage.setItem("hsil_user_institute", formData.institute);
      localStorage.setItem("hsil_user_profession", formData.profession);
    } else {
      // Default for demo login
      localStorage.setItem("hsil_user_name", "Dr. Ahbab");
      localStorage.setItem("hsil_user_institute", "Dhaka Medical College");
      localStorage.setItem("hsil_user_profession", "specialist");
    }
    
    // Simulate successful clinical login/signup and navigate to dashboard
    navigate("/dashboard");
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-900 font-sans">
      
      {/* Left Panel - 2/3 Width - Landing & Parallax Content */}
      <div 
        id="landing-scroll-area"
        className="w-2/3 h-full overflow-y-auto overflow-x-hidden relative scroll-smooth perspective-1000"
        style={{ perspective: "1px" }} // CSS Parallax setup
      >
        
        {/* Floating Dock Header */}
        <header 
          className={`fixed top-6 left-[33.33%] -translate-x-1/2 z-50 transition-all duration-300 w-full max-w-2xl px-6 py-3 rounded-full flex items-center justify-between border ${
            scrolled 
              ? "bg-slate-900/70 border-slate-700/50 backdrop-blur-md shadow-2xl scale-95" 
              : "bg-slate-900/40 border-slate-600/30 backdrop-blur-sm"
          }`}
        >
          <div className="flex items-center gap-2 text-white">
            <Activity className="h-5 w-5 text-blue-400" />
            <span className="font-bold tracking-wide">RadFlow-Edge</span>
          </div>
          <nav className="flex items-center gap-6 text-sm font-medium text-slate-300">
            <a href="#about" className="hover:text-blue-400 transition-colors">About Us</a>
            <a href="#services" className="hover:text-blue-400 transition-colors">Services</a>
            <a href="#nearby" className="hover:text-blue-400 transition-colors flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              Nearby Health Aids
            </a>
          </nav>
        </header>

        {/* Hero Section - Parallax Background */}
        <div className="relative min-h-[90vh] flex flex-col items-center justify-center pt-32 pb-20 px-12 text-center"
             style={{ 
               transformStyle: "preserve-3d",
             }}>
          
          {/* Parallax Background Layer */}
          <div className="absolute inset-0 -z-10 bg-[url('https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center brightness-50"
               style={{
                 transform: "translateZ(-1px) scale(2)", // Push back and scale up for parallax depth
                 transformOrigin: "center center"
               }}
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent" />

          {/* Hero Content */}
          <Badge className="mb-6 bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30 transition-colors py-1.5 px-4 text-sm backdrop-blur-sm">
            AI-Powered Clinical Triage Systems
          </Badge>
          <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight mb-6 leading-tight drop-shadow-2xl">
            Empowering <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Rural Healthcare</span><br />
            with Deep Edge AI.
          </h1>
          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed drop-shadow-md font-light">
            Bringing expert-level radiology insights to the furthest reaches of Bangladesh. 
            Operate fully offline, prioritize critical cases instantly, and save lives when every second counts.
          </p>

          <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-4 max-w-3xl w-full mb-8 backdrop-blur-sm">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-left text-sm">
              <div>
                <p className="text-slate-400">Pipeline</p>
                <p className="text-white font-semibold">{mission?.active_model || "unknown"}</p>
              </div>
              <div>
                <p className="text-slate-400">Queue</p>
                <p className="text-white font-semibold">{mission?.queue_length ?? "--"}</p>
              </div>
              <div>
                <p className="text-slate-400">Urgency</p>
                <p className="text-white font-semibold">{mission?.estimated_wait_time || "--"}</p>
              </div>
              <div>
                <p className="text-slate-400">Recent Errors</p>
                <p className="text-white font-semibold">{mission?.recent_errors ?? "--"}</p>
              </div>
              <div>
                <p className="text-slate-400">Health</p>
                <p className="text-emerald-300 font-semibold">{mission?.status || "offline"}</p>
              </div>
            </div>
          </div>
          
          <div className="flex gap-4">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-8 py-6 text-base font-semibold shadow-xl shadow-blue-900/20">
              Explore Our Tech <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="rounded-full px-8 py-6 text-base" onClick={() => navigate("/dashboard/new-report")}>New Report</Button>
            <Button size="lg" variant="outline" className="rounded-full px-8 py-6 text-base" onClick={() => navigate("/dashboard")}>Urgent Queue</Button>
          </div>
        </div>

        {/* Info Grid Section (Scrolls normally) */}
        <div id="services" className="bg-slate-900 py-24 px-12 relative z-10 border-t border-slate-800">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-white mb-4">Transforming District Hospitals</h2>
              <p className="text-slate-400 max-w-2xl mx-auto">Our modular infrastructure is designed specifically for healthcare environments with low connectivity and high patient volumes.</p>
            </div>
            
            <div className="grid grid-cols-2 gap-8">
              <div className="bg-slate-800/50 border border-slate-700/50 p-8 rounded-2xl backdrop-blur-sm transition-transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-900/20">
                <div className="bg-blue-500/20 p-3 rounded-lg w-fit mb-6">
                  <BrainCircuit className="h-6 w-6 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Offline AI Triage</h3>
                <p className="text-slate-400 leading-relaxed text-sm">
                  Run powerful diagnostic models entirely on local infrastructure. No internet required for life-saving anomaly detection.
                </p>
              </div>
              
              <div className="bg-slate-800/50 border border-slate-700/50 p-8 rounded-2xl backdrop-blur-sm transition-transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-900/20">
                <div className="bg-emerald-500/20 p-3 rounded-lg w-fit mb-6">
                  <ShieldCheck className="h-6 w-6 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Clinical Workflow Integration</h3>
                <p className="text-slate-400 leading-relaxed text-sm">
                  Seamlessly prioritize high-risk patients (like suspected TB) and auto-escalate them to remote specialists when connectivity resumes.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modern Footer section */}
        <footer id="about" className="bg-slate-950 border-t border-slate-800 py-16 px-12 relative z-10">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-12 justify-between">
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-2 text-white mb-6">
                <Activity className="h-6 w-6 text-blue-400" />
                <span className="font-bold text-xl tracking-wide">RadFlow-Edge</span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
                Developed for the HSIL Hackathon 2026. Dedicated to improving public health infrastructure across rural clinics and district hospitals.
              </p>
            </div>
            
            <div className="flex-1 min-w-[250px]">
              <h4 className="text-white font-semibold text-lg mb-6 flex items-center gap-2">
                <HeartPulse className="h-5 w-5 text-red-500" /> 
                Bangladesh Health Services
              </h4>
              <ul className="space-y-4 text-sm">
                <li>
                  <a href="#" className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors group">
                    <div className="bg-red-500/10 p-2 rounded-full group-hover:bg-red-500/20 transition-colors">
                      <PhoneCall className="h-4 w-4 text-red-400" />
                    </div>
                    <div>
                      <span className="block font-semibold text-slate-200">National Emergency</span>
                      <span className="text-red-400 font-bold text-lg">999</span>
                    </div>
                  </a>
                </li>
                <li>
                  <a href="#" className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors group">
                    <div className="bg-blue-500/10 p-2 rounded-full group-hover:bg-blue-500/20 transition-colors">
                      <PhoneCall className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <span className="block font-semibold text-slate-200">Shastho Batayon (Health Line)</span>
                      <span className="text-blue-400 font-bold text-lg">16263</span>
                    </div>
                  </a>
                </li>
                <li className="pt-2">
                  <a href="https://dghs.gov.bd/" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-400 transition-colors flex items-center gap-2">
                    Directorate General of Health Services (DGHS)
                    <ChevronRight className="h-3 w-3" />
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="max-w-4xl mx-auto border-t border-slate-800 mt-12 pt-8 text-center flex items-center justify-between">
            <p className="text-slate-500 text-xs">© 2026 RadFlow-Edge Project. All rights reserved.</p>
            <p className="text-slate-500 text-xs flex items-center gap-1">Built with <HeartPulse className="h-3 w-3 text-red-500" /> for BD.</p>
          </div>
        </footer>
      </div>

      {/* Right Panel - 1/3 Width - Auth Form Container */}
      <div className="w-1/3 h-full bg-white relative flex flex-col shadow-[-20px_0_40px_-15px_rgba(0,0,0,0.5)] z-20">
        
        {/* Subtle decorative background blob */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-blue-50 rounded-full blur-3xl opacity-60 pointer-events-none" />
        
        <div className="flex-1 overflow-y-auto px-10 py-12 custom-scrollbar">
          <div className="max-w-sm mx-auto">
            {/* Header */}
            <div className="mb-10 text-center">
              <div className="inline-flex items-center justify-center p-3 bg-blue-50 rounded-2xl mb-4 text-blue-600">
                <Stethoscope className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                {isLogin ? "Welcome Back" : "Join the Network"}
              </h2>
              <p className="text-slate-500 text-sm">
                {isLogin 
                  ? "Access your specialized clinical dashboard." 
                  : "Register as a healthcare professional to start collaborating."}
              </p>
            </div>

            {/* Auth Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-5 relative z-10">
              
              {!isLogin && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-slate-700">Full Name</Label>
                    <Input 
                      id="fullName" 
                      placeholder="Dr. Sarah Rahman" 
                      required 
                      value={formData.fullName}
                      onChange={handleInputChange}
                      className="bg-slate-50 border-slate-200 focus-visible:ring-blue-500" 
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="age" className="text-slate-700">Age</Label>
                      <Input 
                        id="age" 
                        type="number" 
                        min="18" 
                        max="100" 
                        placeholder="35" 
                        required 
                        value={formData.age}
                        onChange={handleInputChange}
                        className="bg-slate-50 border-slate-200" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gender" className="text-slate-700">Gender</Label>
                      <Select 
                        onValueChange={(val) => handleSelectChange("gender", val)}
                        required
                      >
                        <SelectTrigger id="gender" className="bg-slate-50 border-slate-200">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent className="z-[100]">
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="profession" className="text-slate-700">Profession Profile</Label>
                    <Select 
                      onValueChange={(val) => handleSelectChange("profession", val)}
                      required
                    >
                      <SelectTrigger id="profession" className="bg-slate-50 border-slate-200">
                        <SelectValue placeholder="Select your role" />
                      </SelectTrigger>
                      <SelectContent className="z-[100]">
                        <SelectItem value="physician">General Physician</SelectItem>
                        <SelectItem value="specialist">Specialist / Consultant</SelectItem>
                        <SelectItem value="nurse">Clinical Nurse</SelectItem>
                        <SelectItem value="technician">Radiology Technician</SelectItem>
                        <SelectItem value="admin">Admin / Management</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="institute" className="text-slate-700">Health Institute / Hospital</Label>
                    <Input 
                      id="institute" 
                      placeholder="e.g. Dhaka Medical College" 
                      required 
                      value={formData.institute}
                      onChange={handleInputChange}
                      className="bg-slate-50 border-slate-200 focus-visible:ring-blue-500" 
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700">Email Address</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="professional@hospital.bd" 
                  required 
                  value={formData.email}
                  onChange={handleInputChange}
                  className="bg-slate-50 border-slate-200 focus-visible:ring-blue-500" 
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-slate-700">Password</Label>
                  {isLogin && (
                    <a href="#" className="text-xs font-semibold text-blue-600 hover:text-blue-500">
                      Forgot password?
                    </a>
                  )}
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••" 
                  required 
                  value={formData.password}
                  onChange={handleInputChange}
                  className="bg-slate-50 border-slate-200 focus-visible:ring-blue-500" 
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 py-6 text-base font-semibold mt-6 transition-transform active:scale-[0.98]"
              >
                {isLogin ? "Sign In to Clinic" : "Register Profile"}
              </Button>
            </form>

            <div className="mt-8 relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full bg-slate-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">Secure Clinical Gateway</span>
              </div>
            </div>

            <p className="mt-8 text-center text-sm text-slate-600">
              {isLogin ? "Don't have an account yet?" : "Already registered to the network?"}
              <button 
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="ml-1.5 font-semibold text-blue-600 hover:text-blue-500 hover:underline transition-all"
              >
                {isLogin ? "Create an account" : "Sign in here"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
