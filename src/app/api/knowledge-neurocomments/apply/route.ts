import { createClient as createAdminClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const requestSchema = z.object({
  annotationId: z.string().uuid(),
});

function result(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return result({ error: "Недопустимый источник запроса." }, 403);
  if (Number(request.headers.get("content-length") ?? 0) > 512)
    return result({ error: "Некорректный запрос." }, 400);
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 512) return result({ error: "Некорректный запрос." }, 400);
    body = JSON.parse(raw);
  } catch {
    return result({ error: "Некорректный запрос." }, 400);
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return result({ error: "Некорректный запрос." }, 400);

  const browserSession = await createClient();
  const {
    data: { user },
    error,
  } = await browserSession.auth.getUser();
  if (error || !user) return result({ error: "Войдите в МОЗГ." }, 401);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return result({ error: "Применение правок не настроено." }, 503);
  const admin = createAdminClient<Database>(
    getPublicEnv().NEXT_PUBLIC_SUPABASE_URL,
    key,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data, error: applyError } = await admin.rpc(
    "apply_knowledge_neurocomment",
    {
      target_annotation_id: parsed.data.annotationId,
      target_user_id: user.id,
    },
  );
  if (applyError || !data?.[0])
    return result({ error: "Не удалось применить правку." }, 503);
  const outcome = data[0];
  if (outcome.status === "applied")
    return result({ status: "applied", revision: outcome.revision }, 200);
  if (outcome.status === "conflict")
    return result(
      {
        error:
          "Статья изменилась после предложения. Попросите нейронку проверить её заново.",
      },
      409,
    );
  return result({ error: "Правка недоступна для применения." }, 403);
}
