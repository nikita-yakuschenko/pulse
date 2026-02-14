import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Таймаут одного запроса к Supabase Auth. При медленной сети — увеличить. */
const AUTH_TIMEOUT_MS = 25_000;
/** Пауза перед повтором при таймауте/сетевой ошибке (мс). */
const AUTH_RETRY_DELAY_MS = 2_000;

function isAuthNetworkOrTimeoutError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg === "Auth timeout" || /fetch failed|timeout|ECONNRESET|ETIMEDOUT|unreachable/i.test(msg);
}

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
  const tryGetUser = async (): Promise<{ user: unknown } | null> => {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Auth timeout")), AUTH_TIMEOUT_MS)
    );
    const result = await Promise.race([
      supabase.auth.getUser(),
      timeoutPromise,
    ]);
    return result?.data?.user != null ? { user: result.data.user } : null;
  };

  try {
    const data = await tryGetUser();
    user = data?.user ?? null;
  } catch (firstErr) {
    if (isAuthNetworkOrTimeoutError(firstErr)) {
      try {
        await new Promise((r) => setTimeout(r, AUTH_RETRY_DELAY_MS));
        const data = await tryGetUser();
        user = data?.user ?? null;
      } catch (retryErr) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[auth] Supabase unreachable:", retryErr instanceof Error ? retryErr.message : retryErr);
        }
      }
    } else {
      if (process.env.NODE_ENV === "development") {
        console.warn("[auth] Supabase unreachable:", firstErr instanceof Error ? firstErr.message : firstErr);
      }
    }
  }
  const { pathname } = request.nextUrl;

  // Главная "/" — редирект: если залогинен → dashboard, иначе → sign-in
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = user ? "/dashboard" : "/sign-in";
    return NextResponse.redirect(url);
  }

  // Все пути дашборда (dashboard, construction, docs, purchases) — только для залогиненных
  const dashboardPrefixes = ["/dashboard", "/construction", "/docs", "/purchases"];
  const isDashboardPath = dashboardPrefixes.some((prefix) => pathname.startsWith(prefix));
  if (isDashboardPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
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
