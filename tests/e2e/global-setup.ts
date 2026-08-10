import { createClient } from "@supabase/supabase-js";
import { initialDesktopPrototypeState } from "@/prototype/desktop-state";
import {
  createDesktopDomainSnapshot,
  DESKTOP_DOMAIN_SCHEMA_VERSION,
} from "@/prototype/persistence/domain-snapshot";
import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from "./test-user";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required E2E environment variable: ${name}`);
  return value;
}

export default async function globalSetup(): Promise<void> {
  const supabaseUrl =
    process.env.E2E_SUPABASE_URL ?? requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey =
    process.env.E2E_SUPABASE_ANON_KEY ??
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const signUp = await supabase.auth.signUp({
    email: E2E_USER_EMAIL,
    password: E2E_USER_PASSWORD,
  });
  if (signUp.error) throw signUp.error;
  if (!signUp.data.user || !signUp.data.session) {
    throw new Error("E2E signup did not return an authenticated session");
  }

  const membership = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", signUp.data.user.id)
    .single();
  if (membership.error) throw membership.error;

  const initialize = await supabase.rpc("initialize_workspace_snapshot", {
    target_workspace_id: membership.data.workspace_id,
    target_schema_version: DESKTOP_DOMAIN_SCHEMA_VERSION,
    target_snapshot: createDesktopDomainSnapshot(initialDesktopPrototypeState),
  });
  if (initialize.error) throw initialize.error;

  await supabase.auth.signOut();
}
