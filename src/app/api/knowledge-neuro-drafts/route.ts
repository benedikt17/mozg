import { createClient as createAdminClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const documentsSchema = z
  .array(
    z
      .object({
        title: z.string().trim().min(1).max(250),
        markdown: z.string().max(50_000),
        selected: z.boolean(),
      })
      .strict(),
  )
  .min(1)
  .max(10);
const requestSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("save"),
      id: z.string().uuid(),
      revision: z.number().int().positive(),
      folderPath: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
      documents: documentsSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("publish"),
      id: z.string().uuid(),
      revision: z.number().int().positive(),
    })
    .strict(),
]);
function response(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export async function GET(): Promise<Response> {
  const browser = await createClient();
  const {
    data: { user },
  } = await browser.auth.getUser();
  if (!user) return response({ error: "Войдите в МОЗГ." }, 401);
  const { data, error } = await browser
    .from("knowledge_neuro_drafts")
    .select(
      "id, workspace_id, project_id, folder_path, documents, revision, created_at",
    )
    .eq("created_by", user.id)
    .is("published_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return response({ error: "Не удалось загрузить черновики." }, 503);
  return response({ drafts: data }, 200);
}
export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return response({ error: "Недопустимый источник запроса." }, 403);
  if (Number(request.headers.get("content-length") ?? 0) > 600_000)
    return response({ error: "Слишком большой запрос." }, 413);
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 600_000)
      return response({ error: "Слишком большой запрос." }, 413);
    body = JSON.parse(raw);
  } catch {
    return response({ error: "Некорректный запрос." }, 400);
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return response({ error: "Некорректный запрос." }, 400);
  const browser = await createClient();
  const {
    data: { user },
  } = await browser.auth.getUser();
  if (!user) return response({ error: "Войдите в МОЗГ." }, 401);
  const { data: owned, error: accessError } = await browser
    .from("knowledge_neuro_drafts")
    .select("id")
    .eq("id", parsed.data.id)
    .eq("created_by", user.id)
    .is("published_at", null)
    .maybeSingle();
  if (accessError || !owned)
    return response({ error: "Черновик недоступен." }, 403);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return response({ error: "Публикация не настроена." }, 503);
  const admin = createAdminClient<Database>(
    getPublicEnv().NEXT_PUBLIC_SUPABASE_URL,
    key,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  if (parsed.data.action === "save") {
    const { data, error } = await admin
      .from("knowledge_neuro_drafts")
      .update({
        folder_path: parsed.data.folderPath,
        documents: parsed.data.documents,
        revision: parsed.data.revision + 1,
      })
      .eq("id", parsed.data.id)
      .eq("created_by", user.id)
      .eq("revision", parsed.data.revision)
      .is("published_at", null)
      .select("revision")
      .maybeSingle();
    if (error)
      return response({ error: "Не удалось сохранить черновик." }, 503);
    return data
      ? response({ revision: data.revision }, 200)
      : response({ error: "Черновик изменился. Обновите список." }, 409);
  }
  const { data, error } = await admin.rpc("publish_knowledge_neuro_draft", {
    target_user_id: user.id,
    target_draft_id: parsed.data.id,
    expected_revision: parsed.data.revision,
  });
  if (error || !data?.[0])
    return response({ error: "Не удалось опубликовать документы." }, 503);
  if (data[0].status === "published")
    return response({ status: "published", revision: data[0].revision }, 200);
  if (data[0].status === "empty")
    return response({ error: "Выберите хотя бы один документ." }, 400);
  return response(
    { error: "Черновик или проект изменился. Обновите список." },
    409,
  );
}
