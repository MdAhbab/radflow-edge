export interface ParsedReportSections {
  keyFindings?: string;
  differentialDiagnostics?: string;
  futureStepsPrecautions?: string;
  modelNarrative?: string;
}

const SECTION_HEADERS: Record<keyof ParsedReportSections, string[]> = {
  keyFindings: ["KEY FINDINGS", "TOP FINDING", "MEDICAL FINDINGS", "FINDINGS", "SUMMARY"],
  differentialDiagnostics: ["DIFFERENTIAL DIAGNOSTICS", "DIFFERENTIAL DIAGNOSIS", "DIFFERENTIALS"],
  futureStepsPrecautions: ["FUTURE STEPS/PRECAUTIONS", "FUTURE STEPS", "NEXT STEPS", "RECOMMENDED STEPS", "RECOMMENDATIONS"],
  modelNarrative: ["MODEL NARRATIVE"],
};

const ALL_HEADERS = Array.from(
  new Set(Object.values(SECTION_HEADERS).flat()),
).sort((a, b) => b.length - a.length);

const escapeRegExp = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const parseReportSections = (report?: string | null): ParsedReportSections => {
  const text = (report || "").replace(/\r\n/g, "\n").trim();
  if (!text) return {};

  const sectionResult: ParsedReportSections = {};
  const allHeadersPattern = ALL_HEADERS.map((h) => escapeRegExp(h)).join("|");

  (Object.keys(SECTION_HEADERS) as Array<keyof ParsedReportSections>).forEach((sectionKey) => {
    const aliases = SECTION_HEADERS[sectionKey].map((h) => escapeRegExp(h)).join("|");
    const regex = new RegExp(
      `(?:^|\\n)\\s*(?:${aliases})\\s*:?\\s*([\\s\\S]*?)(?=(?:\\n\\s*(?:${allHeadersPattern})\\s*:?)|$)`,
      "i",
    );
    const match = text.match(regex);
    if (match?.[1]) {
      const cleaned = match[1].replace(/\n{3,}/g, "\n\n").trim();
      if (cleaned.length > 0) {
        sectionResult[sectionKey] = cleaned;
      }
    }
  });

  return sectionResult;
};

export const toPercent = (value?: number | null): string => {
  if (value == null || Number.isNaN(value)) return "0%";
  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.round(normalized)}%`;
};

export const summarizeForCard = (text?: string | null, maxLen: number = 220): string => {
  if (!text) return "";
  const cleaned = text
    .replace(/\s+/g, " ")
    .replace(/\bMODEL NARRATIVE\b\s*:?/gi, "")
    .replace(/\bGenerated using\b/gi, "")
    .trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen).trim()}...`;
};
