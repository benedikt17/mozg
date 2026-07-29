"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/auth/sign-in-form.module.css";
import { createClient } from "@/lib/supabase/browser";
import {
  getOAuthErrorMessage,
  getSafeRedirectPath,
  getSignInErrorMessage,
} from "@/lib/auth/safe-redirect";

export function SignInForm({
  redirectPath,
  oauthError = false,
}: {
  redirectPath: string;
  oauthError?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    oauthError ? getOAuthErrorMessage() : null,
  );
  const [pending, setPending] = useState<"password" | "google" | null>(null);
  const safeRedirectPath = getSafeRedirectPath(redirectPath);
  const googleHref = `/auth/google?next=${encodeURIComponent(safeRedirectPath)}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("password");
    setError(null);
    const { error: signInError } = await createClient().auth.signInWithPassword(
      { email, password },
    );
    if (signInError) {
      setError(getSignInErrorMessage());
      setPending(null);
      return;
    }
    router.replace(safeRedirectPath);
    router.refresh();
  }

  return (
    <main className={styles.screen}>
      <section className={styles.card}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>MOZG</p>
          <h1 className={styles.title}>Войти в MOZG</h1>
          <p className={styles.subtitle}>
            Откройте своё рабочее пространство и продолжите с того места, где
            остановились.
          </p>
        </header>

        <div className={styles.actions}>
          <a
            aria-busy={pending === "google"}
            className={`${styles.button} ${styles.google} ${pending === "google" ? styles.pending : ""}`}
            href={googleHref}
            onClick={() => {
              if (!pending) setPending("google");
            }}
          >
            <span aria-hidden="true" className={styles.googleMark}>
              G
            </span>
            {pending === "google" ? "Переходим…" : "Продолжить с Google"}
          </a>

          <div aria-hidden="true" className={styles.divider}>
            или войти с email
          </div>

          <form className={styles.form} onSubmit={submit}>
            <label className={styles.field}>
              <span>Email</span>
              <input
                className={styles.input}
                autoComplete="email"
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Пароль</span>
              <input
                className={styles.input}
                autoComplete="current-password"
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
            <button
              aria-busy={pending === "password"}
              className={`${styles.button} ${styles.secondary} ${pending === "password" ? styles.pending : ""}`}
              disabled={pending !== null}
              type="submit"
            >
              {pending === "password" ? "Входим…" : "Войти"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
