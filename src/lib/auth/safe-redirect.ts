export function getSafeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//"))
    return "/prototype/desktop";
  try {
    if (new URL(value, "http://localhost").origin !== "http://localhost")
      return "/prototype/desktop";
    decodeURIComponent(value);
  } catch {
    return "/prototype/desktop";
  }
  return value;
}

export function getApplicationOrigin(url: URL): string {
  if (
    url.protocol === "http:" &&
    (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
    url.port === "3000"
  ) {
    return "http://127.0.0.1:3000";
  }
  return url.origin;
}

export function getOAuthErrorMessage(): string {
  return "Не удалось войти через Google. Попробуйте снова или войдите с email и паролем.";
}

export function getSignInErrorMessage(): string {
  return "Не удалось войти. Проверьте email и пароль.";
}
