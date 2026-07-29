import { DesktopPrototypeShell } from "@/prototype/desktop-shell";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DesktopPrototypePage() {
  const { data } = await (await createClient()).auth.getUser();
  if (!data.user) redirect("/sign-in?next=%2Fprototype%2Fdesktop");
  return <DesktopPrototypeShell />;
}
