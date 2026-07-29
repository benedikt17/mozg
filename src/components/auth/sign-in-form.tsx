"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import {
  getSafeRedirectPath,
  getSignInErrorMessage,
} from "@/lib/auth/safe-redirect";

export function SignInForm({ redirectPath }: { redirectPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { error: signInError } = await createClient().auth.signInWithPassword(
      { email, password },
    );
    if (signInError) {
      setError(getSignInErrorMessage());
      setPending(false);
      return;
    }
    router.replace(getSafeRedirectPath(redirectPath));
    router.refresh();
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-8">
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <h1 className="text-3xl font-semibold">Вход</h1>
        <label className="flex flex-col gap-1">
          Email
          <input
            autoComplete="email"
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          Пароль
          <input
            autoComplete="current-password"
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button disabled={pending} type="submit">
          {pending ? "Входим…" : "Войти"}
        </button>
      </form>
    </main>
  );
}
