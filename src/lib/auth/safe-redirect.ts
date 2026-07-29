export function getSafeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//"))
    return "/prototype/desktop";
  return value;
}

export function getSignInErrorMessage(): string {
  return "Не удалось войти. Проверьте email и пароль.";
}
