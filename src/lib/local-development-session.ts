import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { NextRequest, NextResponse } from "next/server";
import { getDesktopRuntimeMode } from "@/lib/local-development-mode";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

const DEFAULT_LOCAL_DEV_USER_EMAIL = "mozg-local-development@example.test";
const DEFAULT_LOCAL_DEV_USER_PASSWORD = "mozg-local-development-only-password";

export type LocalDevelopmentSessionResult =
  | { kind: "skipped" | "existing" | "created" }
  | {
      kind: "unavailable";
      reason: "not-local-supabase" | "missing-service-key" | "auth-failed";
    };

export function isLocalSupabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      url.port === "54321"
    );
  } catch {
    return false;
  }
}

function isUserAlreadyRegistered(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    (normalized.includes("already") && normalized.includes("registered")) ||
    normalized.includes("already exists")
  );
}

function cookieOptions(request: NextRequest, response: NextResponse) {
  return {
    getAll: () => request.cookies.getAll(),
    setAll: (
      items: { name: string; value: string; options: CookieOptions }[],
      headers: Record<string, string>,
    ) => {
      items.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options),
      );
      Object.entries(headers).forEach(([name, value]) =>
        response.headers.set(name, value),
      );
    },
  };
}

/** Local direct access is an accepted development contract; production remains guarded. */
export async function ensureLocalDevelopmentSession(
  request: NextRequest,
  response: NextResponse,
): Promise<LocalDevelopmentSessionResult> {
  if (getDesktopRuntimeMode() !== "local") return { kind: "skipped" };

  const env = getPublicEnv();
  if (!isLocalSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL)) {
    return { kind: "unavailable", reason: "not-local-supabase" };
  }

  const sessionClient = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: cookieOptions(request, response) },
  );
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (user) return { kind: "existing" };

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return { kind: "unavailable", reason: "missing-service-key" };
  }

  const email =
    process.env.MOZG_LOCAL_DEV_USER_EMAIL ?? DEFAULT_LOCAL_DEV_USER_EMAIL;
  const password =
    process.env.MOZG_LOCAL_DEV_USER_PASSWORD ?? DEFAULT_LOCAL_DEV_USER_PASSWORD;
  const adminClient = createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) {
    if (!isUserAlreadyRegistered(createError.message)) {
      return { kind: "unavailable", reason: "auth-failed" };
    }
    const { data: users, error: listError } =
      await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError || !users) {
      return { kind: "unavailable", reason: "auth-failed" };
    }
    const existingUser = users.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
    );
    if (!existingUser) {
      return { kind: "unavailable", reason: "auth-failed" };
    }
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      existingUser.id,
      {
        password,
        email_confirm: true,
      },
    );
    if (updateError) {
      return { kind: "unavailable", reason: "auth-failed" };
    }
  }

  const loginClient = createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data, error: loginError } = await loginClient.auth.signInWithPassword(
    {
      email,
      password,
    },
  );
  if (loginError || !data.session) {
    return { kind: "unavailable", reason: "auth-failed" };
  }

  const { error: setSessionError } = await sessionClient.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (setSessionError) {
    return { kind: "unavailable", reason: "auth-failed" };
  }
  return { kind: "created" };
}
