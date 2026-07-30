import { SignInForm } from "@/components/auth/sign-in-form";
import { getDesktopRuntimeMode } from "@/lib/local-development-mode";
import { redirect } from "next/navigation";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  if (getDesktopRuntimeMode() === "local") redirect("/prototype/desktop");
  const params = await searchParams;
  return (
    <SignInForm
      redirectPath={params.next ?? "/prototype/desktop"}
      oauthError={params.error === "oauth"}
    />
  );
}
