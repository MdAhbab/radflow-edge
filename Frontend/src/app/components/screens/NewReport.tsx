import { useState } from "react";
import { useNavigate } from "react-router";
import { Upload, FileImage, ClipboardList, Loader2, Link as LinkIcon, CheckCircle2 } from "lucide-react";
import { api } from "../../../api";
import { toast } from "sonner";

export function NewReport() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkedPatientFound, setLinkedPatientFound] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    sex: "Male",
    complaint: "",
    patientIdLinked: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreview(url);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const normalizeSexForUI = (rawSex: string | undefined): "Male" | "Female" | "Other" => {
    const value = (rawSex || "").toLowerCase();
    if (value === "m" || value === "male") return "Male";
    if (value === "f" || value === "female") return "Female";
    return "Other";
  };

  const normalizeSexForAPI = (rawSex: string): "M" | "F" | "O" => {
    if (rawSex === "Male") return "M";
    if (rawSex === "Female") return "F";
    return "O";
  };

  const handleLoadLinkedPatient = async () => {
    const linkedId = formData.patientIdLinked.trim();
    if (!linkedId) {
      toast.error("Enter a patient ID to load existing details.");
      return;
    }

    setLinkLoading(true);
    setLinkedPatientFound(false);
    try {
      const existing = await api.getCase(linkedId);
      setFormData((prev) => ({
        ...prev,
        name: existing.name || prev.name,
        age: existing.age ? String(existing.age) : prev.age,
        sex: normalizeSexForUI(existing.sex),
        complaint: existing.complaint || prev.complaint,
      }));
      setLinkedPatientFound(true);
      toast.success(`Loaded patient details for ${linkedId}.`);
    } catch (err) {
      toast.error("Patient ID not found in database.");
    } finally {
      setLinkLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert("Please upload an image for the report.");
      return;
    }

    setLoading(true);
    setSuccess(false);

    try {
      // 1. Upload to .files
      const uploadedPath = await api.uploadFile(selectedFile);

      // 2. Create the case in the DB
      const newCaseData = {
        name: formData.name,
        age: parseInt(formData.age) || 0,
        sex: normalizeSexForAPI(formData.sex),
        complaint: formData.complaint,
        imagePath: uploadedPath,
        aiStatus: "ready" as const,
        triageColor: "green" as const,
        confidence: 0,
        patientId: formData.patientIdLinked || undefined 
      };

      let createdCase = await api.createCase(newCaseData);

      // If auto-analysis on the server did not finish (aiStatus still "ready"), run full pipeline once.
      if (createdCase.aiStatus === "ready" && createdCase.imagePath) {
        try {
          await api.analyzeXray({
            imagePath: createdCase.imagePath,
            patientId: createdCase.patientId,
            patientContext: `${createdCase.age}${createdCase.sex}, complaint: ${createdCase.complaint}`,
            userAction: "new_report_fallback",
          });
          createdCase = await api.getCase(createdCase.patientId);
        } catch (fallbackErr) {
          console.error("Analyze fallback:", fallbackErr);
          toast.warning("Report saved. AI analysis will complete when you open the case.");
        }
      }

      localStorage.setItem("hsil_last_viewed_case", createdCase.patientId);
      
      setSuccess(true);
      setFormData({ name: "", age: "", sex: "Male", complaint: "", patientIdLinked: "" });
      setSelectedFile(null);
      setPreview(null);
      navigate(`/dashboard/case/${createdCase.patientId}`);
    } catch (err: any) {
      console.error("Submission error:", err);
      if (err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError")) {
          alert("Connection Error: The backend server appears to be offline. Please verify that the system is running and try again.");
      } else {
          alert(`Failed to submit: ${err.message || "Unknown error"}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full bg-slate-50 overflow-auto p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 p-6 bg-white">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-6 h-6 text-blue-500" />
            <div>
              <h2 className="text-xl font-semibold text-slate-800">Create New Report</h2>
              <p className="text-sm text-slate-500 mt-1">Upload a patient radiograph and submit demographic data</p>
            </div>
          </div>
        </div>

        {success && (
          <div className="m-6 bg-green-50 text-green-800 p-4 rounded-lg flex items-center gap-3 border border-green-100 animate-in fade-in slide-in-from-top-4">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <p className="font-medium">Successfully processed and queued initial report!</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Left Column: File Upload */}
            <div className="space-y-4">
              <h3 className="font-medium text-slate-700 flex items-center gap-2">
                <FileImage className="w-4 h-4" />
                Image Upload
              </h3>
              
              <div 
                className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors relative cursor-pointer flex flex-col items-center justify-center min-h-[300px]"
                onClick={() => document.getElementById("file-upload")?.click()}
              >
                {preview ? (
                  <div className="relative w-full h-full min-h-[250px] flex items-center justify-center">
                    <img src={preview} alt="Preview" className="max-h-[300px] object-contain rounded-lg" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
                      <p className="text-white font-medium">Click to change image</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-slate-400 mb-3" />
                    <p className="font-medium text-slate-700">Click to Browse</p>
                    <p className="text-xs text-slate-500 mt-1">PNG, JPG, DICOM up to 20MB</p>
                  </>
                )}
                <input 
                  type="file" 
                  id="file-upload" 
                  accept="image/png, image/jpeg, application/dicom" 
                  className="hidden" 
                  onChange={handleFileChange}
                />
              </div>
            </div>

            {/* Right Column: Patient Data */}
            <div className="space-y-5">
              <h3 className="font-medium text-slate-700 flex items-center gap-2">
                Patient Origin Information
              </h3>

              {/* Link Patient ID */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Link to Previous Patient ID (Optional)
                </label>
                <div className="relative flex gap-2">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LinkIcon className="h-4 w-4 text-slate-400" />
                  </div>
                  <input 
                    type="text" 
                    name="patientIdLinked"
                    value={formData.patientIdLinked}
                    onChange={handleChange}
                    placeholder="e.g. PT-BD-001"
                    className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleLoadLinkedPatient}
                    disabled={linkLoading}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {linkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Load"}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Leave blank to assign a new ID. Use Load to prefill details from DB.
                </p>
                {linkedPatientFound && (
                  <p className="text-xs text-emerald-600 mt-1">Existing patient details loaded and ready for edit.</p>
                )}
              </div>

              <hr className="border-slate-100" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                  <input 
                    type="text" 
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Age</label>
                  <input 
                    type="number" 
                    name="age"
                    required
                    value={formData.age}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Biological Sex</label>
                  <select 
                    name="sex"
                    value={formData.sex}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Presenting Complaint</label>
                <textarea 
                  name="complaint"
                  rows={3}
                  required
                  value={formData.complaint}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm resize-none"
                  placeholder="e.g. Persistent cough, chest pain, fever..."
                ></textarea>
              </div>

            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              className="px-5 py-2.5 border border-slate-300 font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 mr-3"
              disabled={loading}
              onClick={() => {
                setFormData({ name: "", age: "", sex: "Male", complaint: "", patientIdLinked: "" });
                setSelectedFile(null);
                setPreview(null);
              }}
            >
              Clear
            </button>
            <button
              type="submit"
              disabled={loading || !selectedFile}
              className="px-5 py-2.5 border border-transparent font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
              ) : (
                "Submit Report to Queue"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
