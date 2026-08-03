import { NextResponse, type NextRequest } from "next/server";
import { getDesktopRuntimeMode } from "@/lib/local-development-mode";
import {
  ensureLocalDevelopmentSession,
  type LocalDevelopmentSessionResult,
} from "@/lib/local-development-session";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";

export const runtime = "nodejs";

const LOCAL_DEVELOPMENT_ORIGINS = {
  "127.0.0.1:3000": "http://127.0.0.1:3000",
  "localhost:3000": "http://localhost:3000",
} as const;

/**
 * Local direct access is a development invariant, not an Auth UI bypass.
 * Cloud persistence still receives an ordinary local Supabase session here.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (getDesktopRuntimeMode() !== "local") {
    return NextResponse.redirect(new URL("/prototype/desktop", request.url));
  }

  const nextPath = getSafeRedirectPath(
    request.nextUrl.searchParams.get("next"),
  );
  const localOrigin = getLocalDevelopmentOrigin(request);
  if (!localOrigin) {
    return new NextResponse("Local development bootstrap unavailable.", {
      status: 404,
      headers: { "cache-control": "no-store" },
    });
  }
  // Preserve one of the two supported incoming hosts so the ordinary Supabase
  // session cookie remains available to the next Desktop SSR request.
  const response = NextResponse.redirect(new URL(nextPath, localOrigin));
  const result = await ensureLocalDevelopmentSession(request, response);
  if (result.kind === "created" || result.kind === "existing") return response;
  if (result.kind === "unavailable") return localBootstrapFailure(result);
  return new NextResponse("Local development bootstrap is unavailable.", {
    status: 503,
    headers: { "cache-control": "no-store" },
  });
}

function getLocalDevelopmentOrigin(request: NextRequest): string | null {
  const host = request.headers.get("host")?.toLowerCase();
  if (!host || !(host in LOCAL_DEVELOPMENT_ORIGINS)) {
    return null;
  }
  return LOCAL_DEVELOPMENT_ORIGINS[
    host as keyof typeof LOCAL_DEVELOPMENT_ORIGINS
  ];
}

function localBootstrapFailure(
  result: Exclude<
    LocalDevelopmentSessionResult,
    { kind: "created" | "existing" | "skipped" }
  >,
): NextResponse {
  void result;
  return new NextResponse("Local development bootstrap is unavailable.", {
    status: 503,
    headers: { "cache-control": "no-store" },
  });
}
