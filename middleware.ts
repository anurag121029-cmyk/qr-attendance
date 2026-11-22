import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const PROTECTED = ["/dashboard", "/classes", "/sessions", "/scan", "/reports"];

export async function middleware(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // When Supabase is not configured, let pages render their explicit
  // "not configured" notice instead of redirecting to sign-in.
  if (!url || !key) return NextResponse.next();
  if (!PROTECTED.some((p) => req.nextUrl.pathname.startsWith(p))) return NextResponse.next();
  const res = NextResponse.next();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) =>
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
    },
  });
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return res;
}

export const config = {
  matcher: ["/dashboard/:path*", "/classes/:path*", "/sessions/:path*", "/scan/:path*", "/reports/:path*"],
};
