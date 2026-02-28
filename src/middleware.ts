import { NextResponse, type NextRequest } from "next/server";

const WINDOW_MS = 60_000;

const limits: Record<string, { max: number }> = {
  "/api/chat": { max: 20 },
  "/api/webhooks/": { max: 200 },
  "/api/openclaw/": { max: 100 },
  "/api/": { max: 60 },
};

type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

function getLimit(pathname: string): number {
  for (const [prefix, cfg] of Object.entries(limits)) {
    if (pathname.startsWith(prefix)) return cfg.max;
  }
  return 60;
}

function isRateLimited(key: string, max: number): { limited: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { limited: false, remaining: max - 1 };
  }

  entry.count++;
  if (entry.count > max) {
    return { limited: true, remaining: 0 };
  }
  return { limited: false, remaining: max - entry.count };
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api/")) return NextResponse.next();

  // Skip rate limiting for webhook signature-verified endpoints in production
  // They have their own auth via signatures
  if (pathname.startsWith("/api/webhooks/")) return NextResponse.next();

  // OpenClaw endpoints are authenticated via x-api-key
  if (pathname.startsWith("/api/openclaw/")) {
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey || apiKey !== process.env.OPENCLAW_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = `${ip}:${pathname}`;
  const max = getLimit(pathname);
  const { limited, remaining } = isRateLimited(key, max);

  if (limited) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": "60",
          "X-RateLimit-Limit": String(max),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(max));
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
