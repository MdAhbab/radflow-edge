import { useEffect, useMemo, useState } from "react";
import { Database, FileText, Search, UserRound, Clock, Eye, Trash2, RotateCcw } from "lucide-react";
import { api, CaseData, EHRTimelineEntry, RecycleBinItem } from "../../../api";
import { Input } from "../ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { toast } from "sonner";

interface PatientGroup {
  patientId: string;
  name: string;
  age: number;
  sex: string;
  reports: CaseData[];
}

export function EHR() {
  const [cases, setCases] = useState<CaseData[]>([]);
  const [timeline, setTimeline] = useState<EHRTimelineEntry[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [selectedReportIndex, setSelectedReportIndex] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [recycleBin, setRecycleBin] = useState<RecycleBinItem[]>([]);
  const [recycleLoading, setRecycleLoading] = useState(false);

  const loadEhr = async () => {
    setLoading(true);
    try {
      const [activeCases, archivedCases] = await Promise.all([
        api.getCases(false),
        api.getCases(true),
      ]);
      const combined = [...activeCases, ...archivedCases];
      setCases(combined);
    } finally {
      setLoading(false);
    }
  };

  const loadRecycleBin = async () => {
    setRecycleLoading(true);
    try {
      const items = await api.getRecycleBin();
      setRecycleBin(items);
    } finally {
      setRecycleLoading(false);
    }
  };

  useEffect(() => {
    loadEhr();
    loadRecycleBin();
  }, []);

  const handleDeletePatientHistory = async (patientId: string, patientName: string) => {
    const confirmed = window.confirm(`Delete all case-history records for ${patientName} (${patientId})? This cannot be undone.`);
    if (!confirmed) return;

    try {
      const result = await api.deletePatientHistory(patientId);
      toast.success(`Moved ${result.softDeletedCases} case records to recycle bin for ${patientId}.`);
      if (selectedPatientId === patientId) {
        setSelectedPatientId("");
        setSelectedReportIndex(0);
      }
      await loadEhr();
      await loadRecycleBin();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete patient history");
    }
  };

  const handleRestorePatientHistory = async (patientId: string) => {
    try {
      const restored = await api.restorePatientHistory(patientId);
      toast.success(`Restored ${restored.softDeletedCases} case records for ${patientId}.`);
      await loadEhr();
      await loadRecycleBin();
      setSelectedPatientId(patientId);
      setSelectedReportIndex(0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restore patient history");
    }
  };

  const patientGroups = useMemo(() => {
    const map = new Map<string, PatientGroup>();

    for (const item of cases) {
      const existing = map.get(item.patientId);
      if (!existing) {
        map.set(item.patientId, {
          patientId: item.patientId,
          name: item.name,
          age: item.age,
          sex: item.sex,
          reports: [item],
        });
      } else {
        existing.reports.push(item);
      }
    }

    const list = Array.from(map.values()).map((group) => ({
      ...group,
      reports: [...group.reports].sort((a, b) => (b.timeReceived || "").localeCompare(a.timeReceived || "")),
    }));

    return list
      .filter((group) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
          group.patientId.toLowerCase().includes(q) ||
          group.name.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.reports.length - a.reports.length);
  }, [cases, search]);

  useEffect(() => {
    if (!selectedPatientId && patientGroups.length > 0) {
      setSelectedPatientId(patientGroups[0].patientId);
      setSelectedReportIndex(0);
      return;
    }

    if (selectedPatientId && !patientGroups.some((p) => p.patientId === selectedPatientId)) {
      setSelectedPatientId(patientGroups[0]?.patientId || "");
      setSelectedReportIndex(0);
    }
  }, [patientGroups, selectedPatientId]);

  const selectedPatient = patientGroups.find((p) => p.patientId === selectedPatientId);
  const reports = selectedPatient?.reports || [];
  const selectedReport = reports[selectedReportIndex] || null;

  useEffect(() => {
    if (!selectedPatientId) {
      setTimeline([]);
      return;
    }

    const loadTimeline = async () => {
      setTimelineLoading(true);
      try {
        const entries = await api.getEhrTimeline(selectedPatientId);
        setTimeline(entries);
      } catch {
        setTimeline([]);
      } finally {
        setTimelineLoading(false);
      }
    };

    loadTimeline();
  }, [selectedPatientId]);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="bg-white border-b border-slate-200 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
              <Database className="h-6 w-6 text-blue-600" />
              EHR Records
            </h2>
            <p className="text-sm text-slate-600 mt-1">Patient-wise electronic records and AI radiology reports</p>
          </div>
          <div className="w-80 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search patient name or ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        <div className="col-span-4 border-r border-slate-200 bg-white overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {loading ? (
                <div className="text-sm text-slate-500">Loading patient records...</div>
              ) : patientGroups.length === 0 ? (
                <div className="text-sm text-slate-500">No EHR records available.</div>
              ) : (
                patientGroups.map((patient) => (
                  <button
                    key={patient.patientId}
                    type="button"
                    onClick={() => {
                      setSelectedPatientId(patient.patientId);
                      setSelectedReportIndex(0);
                      localStorage.setItem("hsil_last_viewed_case", patient.patientId);
                    }}
                    className={`w-full text-left rounded-lg border px-3 py-3 transition-colors ${
                      selectedPatientId === patient.patientId
                        ? "border-blue-300 bg-blue-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-slate-900">{patient.name}</div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{patient.reports.length} reports</Badge>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center h-7 w-7 rounded border border-red-200 text-red-600 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePatientHistory(patient.patientId, patient.name);
                          }}
                          title="Delete patient history"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 mt-1">{patient.patientId}</div>
                    <div className="text-xs text-slate-500 mt-1">{patient.age} yrs / {patient.sex}</div>
                  </button>
                ))
              )}

              <div className="mt-6 pt-4 border-t border-slate-200">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Admin Recycle Bin</div>
                {recycleLoading ? (
                  <div className="text-xs text-slate-500">Loading recycle bin...</div>
                ) : recycleBin.length === 0 ? (
                  <div className="text-xs text-slate-500">Recycle bin is empty.</div>
                ) : (
                  <div className="space-y-2">
                    {recycleBin.map((item) => (
                      <div key={`bin-${item.patientId}`} className="rounded-md border border-amber-200 bg-amber-50 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-medium text-amber-900">{item.patientId}</div>
                            <div className="text-[11px] text-amber-800">{item.caseCount} cases, {item.escalationCount} escalations</div>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => handleRestorePatientHistory(item.patientId)}>
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            Restore
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>

        <div className="col-span-8 overflow-hidden bg-slate-50">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-4">
              {!selectedPatient ? (
                <Card>
                  <CardContent className="py-10 text-center text-slate-500">
                    Select a patient to view EHR history.
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <UserRound className="h-4 w-4" />
                        {selectedPatient.name} ({selectedPatient.patientId})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-slate-600">
                        {selectedPatient.age} years / {selectedPatient.sex} | Total reports: {selectedPatient.reports.length}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Radiology Reports</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {reports.map((report, index) => (
                        <div
                          key={`${report.patientId}-${report.timeReceived}-${index}`}
                          className={`rounded-md border px-3 py-2 flex items-center justify-between ${
                            selectedReportIndex === index ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"
                          }`}
                        >
                          <div>
                            <div className="text-sm font-medium text-slate-900">{report.studyType}</div>
                            <div className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                              <Clock className="h-3 w-3" />
                              {report.timeReceived} | AI: {report.aiStatus}
                            </div>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => setSelectedReportIndex(index)}>
                            <Eye className="h-4 w-4 mr-1.5" />
                            View
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {selectedReport && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          AI Report Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <div><span className="text-slate-500">Complaint:</span> {selectedReport.complaint}</div>
                        <div><span className="text-slate-500">Priority:</span> {selectedReport.priority || "routine"}</div>
                        <div><span className="text-slate-500">Confidence:</span> {Math.round((selectedReport.confidence || 0) * ((selectedReport.confidence || 0) <= 1 ? 100 : 1))}%</div>
                        <div className="border rounded-md p-3 bg-slate-50 whitespace-pre-wrap">
                          {selectedReport.aiDraftReport || "No AI draft report available for this study."}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">EHR Timeline</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {timelineLoading ? (
                        <div className="text-sm text-slate-500">Loading timeline...</div>
                      ) : timeline.length === 0 ? (
                        <div className="text-sm text-slate-500">No timeline events available for this patient.</div>
                      ) : (
                        <div className="space-y-3">
                          {timeline.map((entry, idx) => (
                            <div key={`${entry.timestamp}-${entry.entryType}-${idx}`} className="border rounded-md p-3 bg-white">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-medium text-slate-900">{entry.title}</div>
                                  <div className="text-xs text-slate-500 mt-0.5">
                                    {new Date(entry.timestamp).toLocaleString()}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Badge variant="outline" className="capitalize">{entry.entryType.replace(/_/g, " ")}</Badge>
                                  {entry.status && <Badge variant="secondary" className="capitalize">{entry.status}</Badge>}
                                </div>
                              </div>
                              <div className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{entry.details}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
