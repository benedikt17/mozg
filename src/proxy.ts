import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getDesktopRuntimeMode } from "@/lib/local-development-mode";
import type { Database } from "@/lib/supabase/database.types";
import { getPublicEnv } from "@/lib/env";

const LOCAL_ONLY_PROTOTYPE_PATHS = new Set([
  "/prototype/canvas-image-ingestion-lab",
  "/prototype/canvas-react-flow-ingestion-spike",
  "/prototype/infinite-canvas-local-shell",
]);

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  const runtimeMode = getDesktopRuntimeMode();

  if (
    runtimeMode === "cloud" &&
    LOCAL_ONLY_PROTOTYPE_PATHS.has(request.nextUrl.pathname)
  ) {
    return new NextResponse(null, { status: 404 });
  }

  if (runtimeMode === "local") {
    if (request.nextUrl.pathname === "/auth/local-development") return response;
    const env = getPublicEnv();
    const supabase = createServerClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (items) =>
            items.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            ),
        },
      },
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) return response;
    const bootstrapUrl = new URL("/auth/local-development", request.url);
    bootstrapUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(bootstrapUrl);
  }

  const env = getPublicEnv();
  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) =>
          items.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          ),
      },
    },
  );
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
