import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMcpPublicUrl } from "@/lib/knowledge-mcp/oauth";
import { approveAuthorization, denyAuthorization } from "./actions";

export const dynamic = "force-dynamic";

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string; error?: string }>;
}): Promise<React.JSX.Element> {
  const { authorization_id: authorizationId, error: decisionError } =
    await searchParams;
  if (!getMcpPublicUrl()) {
    return (
      <main>
        <h1>Подключение MCP пока отключено</h1>
      </main>
    );
  }
  if (!authorizationId || !/^[\w-]{1,250}$/.test(authorizationId)) {
    return (
      <main>
        <h1>Недействительный запрос доступа</h1>
      </main>
    );
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/sign-in?next=${encodeURIComponent(`/oauth/consent?authorization_id=${authorizationId}`)}`,
    );
  }
  const { data, error } =
    await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !data)
    return (
      <main>
        <h1>Запрос доступа недоступен</h1>
      </main>
    );
  if (!("authorization_id" in data)) redirect(data.redirect_url);

  return (
    <main
      style={{
        maxWidth: 620,
        margin: "8vh auto",
        padding: 24,
        fontFamily: "sans-serif",
        lineHeight: 1.5,
      }}
    >
      <h1>Доступ к знаниям «МОЗГА»</h1>
      <p>
        <strong>{data.client.name}</strong> запрашивает подключение от вашего
        имени.
      </p>
      <p>
        Инструменты MCP позволяют читать все доступные вам статьи «Знаний» во
        всех проектах и не содержат операций записи.
      </p>
      <p>
        <strong>Права токена шире инструментов MCP:</strong> OAuth-токен
        действует от вашего имени и может обращаться к другим разрешённым вам
        данным Supabase. Разрешайте доступ только в изолированной тестовой
        среде, пока ограничения прав OAuth-клиента не проверены.
      </p>
      <p>
        Адрес клиента:{" "}
        <code style={{ overflowWrap: "anywhere" }}>{data.redirect_uri}</code>
      </p>
      <p>
        Запрошенные разрешения: <code>{data.scope}</code>
      </p>
      {decisionError && (
        <p role="alert">Не удалось обработать решение. Попробуйте ещё раз.</p>
      )}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <form action={approveAuthorization}>
          <input
            type="hidden"
            name="authorization_id"
            value={authorizationId}
          />
          <button type="submit">Разрешить чтение</button>
        </form>
        <form action={denyAuthorization}>
          <input
            type="hidden"
            name="authorization_id"
            value={authorizationId}
          />
          <button type="submit">Отказать</button>
        </form>
      </div>
    </main>
  );
}
