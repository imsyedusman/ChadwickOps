import { ssoHandler } from "@/lib/production-sso-runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = ssoHandler("logout");
export const POST = ssoHandler("logout");
