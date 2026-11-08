import { ssoHandler } from "@/lib/production-sso-runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = ssoHandler("revalidate");
