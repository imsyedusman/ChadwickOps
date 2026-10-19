import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export function verifyProductionApiAuth(req: NextRequest): { authorized: boolean; response?: NextResponse } {
  const configuredKey = process.env.CHADWICK_PRODUCTION_API_KEY || process.env.PRODUCTION_API_KEY;

  if (!configuredKey || configuredKey.trim().length === 0) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Production API key is not configured on this provider." },
        { status: 500 }
      ),
    };
  }

  // Extract from Authorization header (Bearer token) or x-api-key
  const authHeader = req.headers.get("authorization") || "";
  let providedToken = "";

  if (authHeader.startsWith("Bearer ")) {
    providedToken = authHeader.slice(7).trim();
  } else if (req.headers.has("x-api-key")) {
    providedToken = req.headers.get("x-api-key")?.trim() || "";
  }

  if (!providedToken) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Unauthorized: Missing Authorization header or x-api-key." },
        { status: 401 }
      ),
    };
  }

  // Constant-time comparison to prevent timing attacks
  const keyBuffer = Buffer.from(configuredKey);
  const tokenBuffer = Buffer.from(providedToken);

  if (keyBuffer.length !== tokenBuffer.length || !crypto.timingSafeEqual(keyBuffer, tokenBuffer)) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Unauthorized: Invalid API key." },
        { status: 401 }
      ),
    };
  }

  return { authorized: true };
}
