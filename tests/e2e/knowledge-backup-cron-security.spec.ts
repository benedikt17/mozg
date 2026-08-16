import { expect, test } from "@playwright/test";

for (const kind of ["daily", "weekly"] as const) {
  test(`rejects unauthenticated ${kind} Knowledge backup cron`, async ({
    request,
  }) => {
    const response = await request.get(`/api/cron/knowledge-backup/${kind}`, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toEqual({ ok: false });
  });
}
