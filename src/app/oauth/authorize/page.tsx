import { redirect } from "next/navigation";
import { getMcpPublicUrl } from "@/lib/knowledge-mcp/oauth";
import { createClient } from "@/lib/supabase/server";
import { approveMcpAccess, denyMcpAccess } from "./actions";
import { validateAuthorizationRequest } from "./flow";

export const dynamic = "force-dynamic";

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const query = await searchParams;
  if (!getMcpPublicUrl()) return <main>Подключение MCP отключено.</main>;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (typeof value === "string") params.set(key, value);
  const request = await validateAuthorizationRequest(params);
  if (!request) return <main>Недействительный запрос доступа.</main>;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    redirect(
      `/sign-in?next=${encodeURIComponent(`/oauth/authorize?${params}`)}`,
    );

  return (
    <main style={{ maxWidth: 600, margin: "8vh auto", padding: 24 }}>
      <h1>Подключить «МОЗГ» к нейронке</h1>
      <p>
        Подключение сможет читать все доступные вам статьи раздела «Знания». Оно
        не даёт права изменять документы, задачи или файлы.
      </p>
      <p>Аккаунт: {user.email}</p>
      <p>Клиент: ChatGPT Work</p>
      <div style={{ display: "flex", gap: 16 }}>
        {[
          [approveMcpAccess, "Разрешить чтение"],
          [denyMcpAccess, "Отказать"],
        ].map(([action, label]) => (
          <form
            key={label as string}
            action={action as (form: FormData) => Promise<void>}
          >
            {[...params].map(([key, value]) => (
              <input type="hidden" key={key} name={key} value={value} />
            ))}
            <button type="submit">{label as string}</button>
          </form>
        ))}
      </div>
    </main>
  );
}
