// Checkr criminal + sex offender background check.
//
// Why Checkr: industry standard for US background screening. Their "tasker
// pro" / "tasker basic+" packages include:
//   - National Sex Offender Registry
//   - National Criminal Database (felony + misdemeanor)
//   - SSN trace
//   - Watchlist (additional layer beyond OFAC)
//
// Cost: ~$5-15 per Basic+ report; ~$25-35 for Full.
//
// Flow:
//   1. createCandidate(checkSessionId) → POST /candidates with name + DOB
//   2. createReport(candidateId, package) → POST /reports
//   3. Webhook fires when report status flips to clear/consider/suspended
//   4. We mirror status into CheckSession.checkrStatus
//
// Checkr requires a verified business account before going live, but you can
// integrate against their staging API immediately with a test key.
// Docs: https://docs.checkr.com

const CHECKR_API_BASE = "https://api.checkr.com/v1";

export type CheckrConfig = {
  apiKey: string;
  defaultPackage: string; // e.g. "tasker_basic_plus"
};

export function getCheckrConfig(): CheckrConfig | null {
  const apiKey = process.env.CHECKR_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    defaultPackage: process.env.CHECKR_PACKAGE || "tasker_basic_plus",
  };
}

export function isCheckrConfigured(): boolean {
  return Boolean(process.env.CHECKR_API_KEY);
}

type CheckrCandidate = { id: string; first_name: string; last_name: string };
type CheckrReport = {
  id: string;
  status: "pending" | "clear" | "consider" | "suspended";
  adjudication?: "engaged" | "post_adverse_action" | "pre_adverse_action" | null;
  package: string;
  national_criminal_search?: { id: string; status: string };
  sex_offender_search?: { id: string; status: string };
  ssn_trace?: { id: string; status: string };
};

export async function createCheckrCandidate(opts: {
  fullName: string;
  email?: string;
  dateOfBirth?: string;
  driverLicenseNumber?: string;
  driverLicenseState?: string;
  workLocations?: { country: string; state?: string }[];
}): Promise<{ id: string }> {
  const cfg = getCheckrConfig();
  if (!cfg) throw new Error("CHECKR_API_KEY not configured");

  const parts = opts.fullName.trim().split(/\s+/);
  const first_name = parts[0] || "";
  const last_name = parts.length > 1 ? parts[parts.length - 1] : parts[0] || "";
  const middle_name = parts.length > 2 ? parts.slice(1, -1).join(" ") : "";

  const body: any = {
    first_name,
    last_name,
    work_locations: opts.workLocations || [{ country: "US" }],
    no_middle_name: !middle_name,
  };
  if (middle_name) body.middle_name = middle_name;
  if (opts.email) body.email = opts.email;
  if (opts.dateOfBirth) body.dob = opts.dateOfBirth; // YYYY-MM-DD
  if (opts.driverLicenseNumber) body.driver_license_number = opts.driverLicenseNumber;
  if (opts.driverLicenseState) body.driver_license_state = opts.driverLicenseState;

  const res = await fetch(`${CHECKR_API_BASE}/candidates`, {
    method: "POST",
    headers: {
      Authorization: basic(cfg.apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Checkr createCandidate: HTTP ${res.status} ${await res.text()}`);
  const data = (await res.json()) as CheckrCandidate;
  return { id: data.id };
}

export async function createCheckrReport(opts: {
  candidateId: string;
  pkg?: string;
}): Promise<{ id: string; status: string }> {
  const cfg = getCheckrConfig();
  if (!cfg) throw new Error("CHECKR_API_KEY not configured");

  const res = await fetch(`${CHECKR_API_BASE}/reports`, {
    method: "POST",
    headers: {
      Authorization: basic(cfg.apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      candidate_id: opts.candidateId,
      package: opts.pkg || cfg.defaultPackage,
    }),
  });
  if (!res.ok) throw new Error(`Checkr createReport: HTTP ${res.status} ${await res.text()}`);
  const data = (await res.json()) as CheckrReport;
  return { id: data.id, status: data.status };
}

export async function getCheckrReport(reportId: string): Promise<CheckrReport> {
  const cfg = getCheckrConfig();
  if (!cfg) throw new Error("CHECKR_API_KEY not configured");
  const res = await fetch(`${CHECKR_API_BASE}/reports/${reportId}`, {
    headers: { Authorization: basic(cfg.apiKey) },
  });
  if (!res.ok) throw new Error(`Checkr getReport: HTTP ${res.status}`);
  return (await res.json()) as CheckrReport;
}

// Stable summary for the UI: derives a short list of findings from a fetched
// report. Used when the status transitions to "consider".
export type CheckrFinding = {
  type: "criminal" | "sex_offender" | "ssn_trace" | "other";
  severity: "info" | "warning" | "critical";
  summary: string;
};

export function summarizeCheckrReport(report: CheckrReport): CheckrFinding[] {
  const out: CheckrFinding[] = [];
  if (report.sex_offender_search && report.sex_offender_search.status === "consider") {
    out.push({ type: "sex_offender", severity: "critical", summary: "Match in National Sex Offender Registry" });
  }
  if (report.national_criminal_search && report.national_criminal_search.status === "consider") {
    out.push({ type: "criminal", severity: "warning", summary: "Records found in national criminal database" });
  }
  if (report.ssn_trace && report.ssn_trace.status === "consider") {
    out.push({ type: "ssn_trace", severity: "info", summary: "SSN trace anomaly — name/address mismatch" });
  }
  if (report.adjudication === "post_adverse_action") {
    out.push({ type: "other", severity: "critical", summary: "Adverse action issued (declined)" });
  }
  return out;
}

function basic(apiKey: string): string {
  return "Basic " + Buffer.from(`${apiKey}:`).toString("base64");
}
