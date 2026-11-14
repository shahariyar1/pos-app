import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 `proxy` (formerly middleware).
 * Optional HTTP Basic Auth for the whole app. Active only when
 * BASIC_AUTH_USER and BASIC_AUTH_PASS are set. Swap for a real auth
 * provider (Auth.js, Better Auth) when you need per-user roles.
 */
export function proxy(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASS;
  if (!user || !pass) return NextResponse.next();

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const i = decoded.indexOf(":");
    if (decoded.slice(0, i) === user && decoded.slice(i + 1) === pass) {
      return NextResponse.next();
    }
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Memo POS"' },
  });
}

export const config = {
  // the install files must stay reachable without the password prompt
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icon-192.png|icon-512.png|apple-touch-icon.png).*)"],
};
