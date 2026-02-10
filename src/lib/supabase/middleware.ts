import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_TIMEOUT_MS = 8_000;

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let user = null;
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Auth timeout")), AUTH_TIMEOUT_MS)
    );
    const result = await Promise.race([
      supabase.auth.getUser(),
      timeoutPromise,
    ]);
    user = result?.data?.user ?? null;
  } catch (err) {
    // 504, network error, timeout — считаем "не залогинен", не блокируем приложение
    if (process.env.NODE_ENV === "development") {
      console.warn("[auth] Supabase unreachable:", err instanceof Error ? err.message : err);
    }
  }
  const { pathname } = request.nextUrl;

  // Главная "/" — редирект: если залогинен → dashboard, иначе → sign-in
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = user ? "/dashboard" : "/sign-in";
    return NextResponse.redirect(url);
  }

  // /dashboard и подразделы — только для залогиненных
  if (pathname.startsWith("/dashboard")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/sign-in";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
  }

  // /sign-in, /sign-up — если уже залогинен, редирект на dashboard
  if (pathname === "/sign-in" || pathname === "/sign-up") {
    if (user) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
