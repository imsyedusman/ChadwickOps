import { handlers } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { RateLimiterMemory } from "rate-limiter-flexible";

const rateLimiter = new RateLimiterMemory({
  points: 5,
  duration: 5 * 60, // 5 minutes (in seconds)
});

export const GET = async (request: NextRequest) => {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/api/auth/rate-limit") {
    const ip = (request as any).ip || 
               request.headers.get("x-forwarded-for")?.split(",")[0].trim() || 
               request.headers.get("x-real-ip") || 
               "127.0.0.1";

    const rateLimiterRes = await rateLimiter.get(ip);
    const remainingPoints = rateLimiterRes ? rateLimiterRes.remainingPoints : 5;
    const retryAfter = rateLimiterRes && rateLimiterRes.msBeforeNext ? Math.round(rateLimiterRes.msBeforeNext / 1000) : 0;

    return NextResponse.json({
      remainingPoints,
      retryAfter,
    });
  }
  return handlers.GET(request);
};

export const POST = async (request: NextRequest) => {
  const pathname = request.nextUrl.pathname;
  const lowerPath = pathname.toLowerCase();

  // Intercept credentials login attempts only
  if (lowerPath.includes("/callback/credentials") || lowerPath.includes("/signin/credentials")) {
    const ip = (request as any).ip || 
               request.headers.get("x-forwarded-for")?.split(",")[0].trim() || 
               request.headers.get("x-real-ip") || 
               "127.0.0.1";

    try {
      await rateLimiter.consume(ip, 1);
    } catch (rateLimiterRes: any) {
      return NextResponse.json(
        { 
          error: "Too many login attempts, please try again later",
          retryAfter: Math.round(rateLimiterRes.msBeforeNext / 1000),
          remainingPoints: 0
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(Math.round(rateLimiterRes.msBeforeNext / 1000) || 1)
          }
        }
      );
    }
  }

  return handlers.POST(request);
};
