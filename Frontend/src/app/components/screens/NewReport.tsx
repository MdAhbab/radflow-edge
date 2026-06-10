import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Upload, FileImage, ClipboardList, Loader2, Link as LinkIcon } from "lucide-react";
import { api } from "../../../api";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

export function NewReport() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
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
  const previewUrlRef = useRef<string | null>(null);

  // Object URLs must be revoked or each selected file leaks until reload.
  const setPreviewUrl = (url: string | null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = url;
    setPreview(url);
  };

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
    } catch {
      toast.error("Patient ID not found in database.");
    } finally {
      setLinkLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Please upload a radiograph image for the report.");
      return;
    }

    setLoading(true);

    try {
      const uploadedPath = await api.uploadFile(selectedFile);

      // Analysis runs asynchronously server-side; the case review screen
      // polls findings until the pipeline completes.
      const createdCase = await api.createCase({
        name: formData.name,
        age: parseInt(formData.age) || 0,
        sex: normalizeSexForAPI(formData.sex),
        complaint: formData.complaint,
        imagePath: uploadedPath,
        aiStatus: "ready" as const,
        triageColor: "green" as const,
        confidence: 0,
        patientId: formData.patientIdLinked || undefined,
      });

      localStorage.setItem("hsil_last_viewed_case", createdCase.patientId);
      setPreviewUrl(null);
      toast.success("Report submitted. AI analysis is running.");
      navigate(`/dashboard/case/${createdCase.patientId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (/fetch|network/i.test(message)) {
        toast.error("Connection error: the backend appears to be offline. Verify the system is running and try again.");
      } else {
        toast.error(`Failed to submit: ${message}`);
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
                    <img src={preview} alt="Selected radiograph preview" className="max-h-[300px] object-contain rounded-lg" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
                      <p className="text-white font-medium">Click to change image</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-slate-400 mb-3" />
                    <p className="font-medium text-slate-700">Click to Browse</p>
                    <p className="text-xs text-slate-500 mt-1">PNG, JPG, DICOM up to 50MB</p>
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
              <h3 className="font-medium text-slate-700">Patient Origin Information</h3>

              {/* Link Patient ID */}
              <div className="space-y-1.5">
                <Label htmlFor="patientIdLinked">Link to Previous Patient ID (Optional)</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <Input
                      id="patientIdLinked"
                      name="patientIdLinked"
                      value={formData.patientIdLinked}
                      onChange={handleChange}
                      placeholder="e.g. PT-BD-001"
                      className="pl-10"
                    />
                  </div>
                  <Button type="button" variant="outline" onClick={handleLoadLinkedPatient} disabled={linkLoading}>
                    {linkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Load"}
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  Leave blank to assign a new ID. Use Load to prefill details from DB.
                </p>
                {linkedPatientFound && (
                  <p className="text-xs text-emerald-600">Existing patient details loaded and ready for edit.</p>
                )}
              </div>

              <hr className="border-slate-100" />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="patient-name">Full Name</Label>
                  <Input id="patient-name" name="name" required value={formData.name} onChange={handleChange} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="patient-age">Age</Label>
                  <Input id="patient-age" type="number" name="age" required min={0} max={130} value={formData.age} onChange={handleChange} />
                </div>

                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="patient-sex">Biological Sex</Label>
                  <Select value={formData.sex} onValueChange={(value) => setFormData(prev => ({ ...prev, sex: value }))}>
                    <SelectTrigger id="patient-sex" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="patient-complaint">Presenting Complaint</Label>
                <Textarea
                  id="patient-complaint"
                  name="complaint"
                  rows={3}
                  required
                  value={formData.complaint}
                  onChange={handleChange}
                  className="resize-none"
                  placeholder="e.g. Persistent cough, chest pain, fever..."
                />
              </div>

            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => {
                setFormData({ name: "", age: "", sex: "Male", complaint: "", patientIdLinked: "" });
                setSelectedFile(null);
                setPreviewUrl(null);
                setLinkedPatientFound(false);
              }}
            >
              Clear
            </Button>
            <Button type="submit" disabled={loading || !selectedFile}>
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
              ) : (
                "Submit Report to Queue"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
