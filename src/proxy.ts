export { auth as proxy } from "@/auth";

export const config = {
  // Protect all operational page routes but bypass APIs, static assets, images, and login
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login).*)"],
};
