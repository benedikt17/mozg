import { SignInForm } from "@/components/auth/sign-in-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <SignInForm
      redirectPath={params.next ?? "/prototype/desktop"}
      oauthError={params.error === "oauth"}
    />
  );
}
