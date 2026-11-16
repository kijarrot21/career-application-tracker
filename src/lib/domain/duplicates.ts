/**
 * URL normalization, platform detection, and duplicate helpers.
 *
 * IMPORTANT: these functions only inspect the URL string. The application
 * never fetches or scrapes external job platform pages.
 */

export const SYSTEM_SOURCES = [
  { key: "linkedin", name: "LinkedIn", domains: ["linkedin.com"] },
  { key: "jobstreet", name: "JobStreet", domains: ["jobstreet.co.id", "jobstreet.com", "jobstreet.com.my", "jobstreet.com.sg", "jobstreet.com.ph", "id.jobstreet.com", "seek.com.au"] },
  { key: "indeed", name: "Indeed", domains: ["indeed.com", "id.indeed.com", "indeed.co.id"] },
  { key: "glints", name: "Glints", domains: ["glints.com", "glints.id"] },
  { key: "kalibrr", name: "Kalibrr", domains: ["kalibrr.com", "kalibrr.id"] },
  {
    key: "company_career",
    name: "Company Career Page",
    domains: ["greenhouse.io", "lever.co", "myworkdayjobs.com", "smartrecruiters.com", "ashbyhq.com", "workable.com", "breezy.hr", "bamboohr.com", "recruitee.com", "teamtailor.com"],
  },
  { key: "referral", name: "Referral", domains: [] },
  { key: "other", name: "Other", domains: [] },
] as const;

export type SystemSourceKey = (typeof SYSTEM_SOURCES)[number]["key"];

const TRACKING_PARAMS = new Set([
  "trk",
  "trkinfo",
  "refid",
  "trackingid",
  "ref",
  "src",
  "source",
  "fbclid",
  "gclid",
  "mcid",
  "lipi",
  "originalsubdomain",
  "from",
  "tk",
  "sectionrank",
  "searchrequesttoken",
  "ebp",
  "position",
  "pagenum",
]);

function parseHttpUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function hostOf(url: URL): string {
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function isHttpUrl(raw: string): boolean {
  return parseHttpUrl(raw) !== null;
}

/**
 * Canonical form used for duplicate detection: lowercase host without www,
 * no hash, tracking params removed, params sorted, no trailing slash.
 * LinkedIn search URLs with currentJobId are converted to /jobs/view/<id>.
 */
export function normalizeUrl(raw: string): string | null {
  const url = parseHttpUrl(raw);
  if (!url) return null;
  const host = hostOf(url);

  if (hostMatches(host, "linkedin.com")) {
    const id = extractExternalJobId(raw);
    if (id) return `https://linkedin.com/jobs/view/${id}`;
  }
  if (hostMatches(host, "indeed.com") || hostMatches(host, "indeed.co.id")) {
    const id = extractExternalJobId(raw);
    if (id) return `https://${host}/viewjob?jk=${id}`;
  }

  const params = [...url.searchParams.entries()]
    .filter(([k]) => {
      const key = k.toLowerCase();
      return !key.startsWith("utm_") && !TRACKING_PARAMS.has(key);
    })
    .sort(([a], [b]) => a.localeCompare(b));
  const query = new URLSearchParams(params).toString();
  const path = url.pathname.replace(/\/+$/, "") || "";
  return `https://${host}${path}${query ? `?${query}` : ""}`;
}

/** Detect a system job source from the URL domain. Returns null if unknown. */
export function detectSource(raw: string): SystemSourceKey | null {
  const url = parseHttpUrl(raw);
  if (!url) return null;
  const host = hostOf(url);
  for (const source of SYSTEM_SOURCES) {
    if (source.domains.some((d) => hostMatches(host, d))) return source.key;
  }
  if (/(^|\.)careers?\./.test(host) || /^jobs\./.test(host) || /\/careers?(\/|$)/.test(url.pathname)) {
    return "company_career";
  }
  return null;
}

/** Extract the platform's own job identifier from known URL patterns. */
export function extractExternalJobId(raw: string): string | null {
  const url = parseHttpUrl(raw);
  if (!url) return null;
  const host = hostOf(url);
  const path = url.pathname;

  if (hostMatches(host, "linkedin.com")) {
    const current = url.searchParams.get("currentJobId");
    if (current && /^\d+$/.test(current)) return current;
    const m = path.match(/\/jobs\/view\/(?:[^/]*?-)?(\d{6,})\/?/);
    return m ? m[1] : null;
  }
  if (SYSTEM_SOURCES[1].domains.some((d) => hostMatches(host, d))) {
    const param = url.searchParams.get("jobId");
    if (param && /^\d+$/.test(param)) return param;
    const m = path.match(/\/job\/(?:[^/]*?-)?(\d{5,})\/?/);
    return m ? m[1] : null;
  }
  if (hostMatches(host, "indeed.com") || hostMatches(host, "indeed.co.id")) {
    const jk = url.searchParams.get("jk") ?? url.searchParams.get("vjk");
    return jk && /^[a-z0-9]+$/i.test(jk) ? jk.toLowerCase() : null;
  }
  if (hostMatches(host, "glints.com") || hostMatches(host, "glints.id")) {
    const m = path.match(/\/jobs\/[^/]+\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    return m ? m[1].toLowerCase() : null;
  }
  if (hostMatches(host, "kalibrr.com") || hostMatches(host, "kalibrr.id")) {
    const m = path.match(/\/jobs\/(\d+)/);
    return m ? m[1] : null;
  }
  return null;
}

const COMPANY_SUFFIXES = new Set([
  "pt",
  "tbk",
  "cv",
  "persero",
  "inc",
  "ltd",
  "llc",
  "corp",
  "corporation",
  "co",
  "company",
  "limited",
  "plc",
  "gmbh",
  "bv",
  "sdn",
  "bhd",
  "pte",
]);

/** Lowercase, strip punctuation and legal-entity suffixes for matching. */
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !COMPANY_SUFFIXES.has(w))
    .join(" ")
    .trim();
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
