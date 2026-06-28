const MCP_API_KEY = process.env.MCP_API_KEY;

// --- Simple in-memory rate limiter (per-instance, for dev/small scale) ---
const hits = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 30;  // per window per key

function getRateKey(req: Request): string {
  const apiKey = req.headers.get("x-api-key") || "";
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
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
function checkAuth(req: Request): { ok: boolean; error?: string } {
  if (!MCP_API_KEY) return { ok: true }; // no key configured = open access
  const provided = req.headers.get("x-api-key");
  if (!provided) return { ok: false, error: "Missing X-API-Key header" };
  if (provided !== MCP_API_KEY) return { ok: false, error: "Invalid API key" };
  return { ok: true };
}

export interface MiddlewareResult {
  response?: Response;
  rateLimit?: { remaining: number; resetAt: number };
}

export function middleware(req: Request): MiddlewareResult {
  // Auth
  const auth = checkAuth(req);
  if (!auth.ok) {
    return {
      response: new Response(
        JSON.stringify({ content: [{ type: "text", text: auth.error }] }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  // Rate limit
  const rateKey = getRateKey(req);
  const rate = checkRateLimit(rateKey);
  if (!rate.allowed) {
    return {
      response: new Response(
        JSON.stringify({ content: [{ type: "text", text: `Rate limit exceeded. Try again in ${Math.ceil((rate.resetAt - Date.now()) / 1000)}s.` }] }),
        { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil((rate.resetAt - Date.now()) / 1000)) } }
      ),
    };
  }

  return { rateLimit: rate };
}
