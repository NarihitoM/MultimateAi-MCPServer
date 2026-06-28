const MCP_API_KEY = process.env.MCP_API_KEY;

// --- Simple in-memory rate limiter (per-instance, for dev/small scale) ---
const hits = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 30;  // per window per key

function getRateKey(req: any): string {
  const apiKey = (req.headers["x-api-key"] as string) || "";
  const forwarded = (req.headers["x-forwarded-for"] as string) || "";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";
  return apiKey || ip;
}

function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS - 1, resetAt: now + WINDOW_MS };
  }

  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: MAX_REQUESTS - entry.count, resetAt: entry.resetAt };
}

// --- Auth check ---
function checkAuth(req: any): { ok: boolean; error?: string } {
  if (!MCP_API_KEY) return { ok: true }; // no key configured = open access
  const provided = req.headers["x-api-key"];
  if (!provided) return { ok: false, error: "Missing X-API-Key header" };
  if (provided !== MCP_API_KEY) return { ok: false, error: "Invalid API key" };
  return { ok: true };
}

export interface MiddlewareResult {
  error?: string;
  statusCode?: number;
  rateLimit?: { remaining: number; resetAt: number };
}

export function middleware(req: any): MiddlewareResult {
  // Auth
  const auth = checkAuth(req);
  if (!auth.ok) {
    return { error: auth.error, statusCode: 401 };
  }

  // Rate limit
  const rateKey = getRateKey(req);
  const rate = checkRateLimit(rateKey);
  if (!rate.allowed) {
    return {
      error: `Rate limit exceeded. Try again in ${Math.ceil((rate.resetAt - Date.now()) / 1000)}s.`,
      statusCode: 429,
    };
  }

  return { rateLimit: rate };
}
