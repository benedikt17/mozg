/** Match the browser's origin against the incoming Host, not Next's internal URL. */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  try {
    const source = new URL(origin);
    const target = new URL(request.url);
    const host = request.headers.get("host")?.toLowerCase() ?? target.host;
    return (
      source.origin === origin &&
      source.protocol === target.protocol &&
      source.host === host
    );
  } catch {
    return false;
  }
}
