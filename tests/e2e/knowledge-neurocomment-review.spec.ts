import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { initialDesktopPrototypeState } from "@/prototype/desktop-state";
import { createDesktopDomainSnapshot } from "@/prototype/persistence/domain-snapshot";
import { E2E_USER_PASSWORD } from "./test-user";

test("accepts neighboring proposals and navigates formatted and collapsed Markdown", async ({
  page,
}) => {
  const url = process.env.E2E_SUPABASE_URL!;
  const user = createClient(url, process.env.E2E_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `neuro-review-${randomUUID()}@example.test`;
  const signup = await user.auth.signUp({ email, password: E2E_USER_PASSWORD });
  expect(signup.error).toBeNull();
  const userId = signup.data.user!.id;
  const membership = await service
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .single();
  expect(membership.error).toBeNull();
  const workspaceId = membership.data!.workspace_id;
  const documentId = `review-${randomUUID()}`;
  const anchor = "Один сильный кадр лучше шести слабых.";
  const quote =
    "Строго соблюдай структуру `template.json`.\n\nНе меняй **schema** и поля.";
  const nested = "Дочерняя **цитата** для перехода.";
  const replacement =
    "**Новая** структура `template.json`.\n\nСохранён второй абзац.";
  const insertion = "\n\nВнедрённое **дополнение**.";
  const markdown = [
    "# Review test",
    "",
    "[[doc:doc-l-map|Ссылка]]",
    "",
    anchor,
    "",
    quote,
    "",
    "- Родитель",
    `  - ${nested}`,
  ].join("\n");
  const snapshot = createDesktopDomainSnapshot(initialDesktopPrototypeState);
  snapshot.documents.push({
    id: documentId,
    projectId: "lukomorie",
    folder: "",
    folderPath: [],
    title: "Review test",
    excerpt: "",
    content: markdown.split("\n"),
    backlinks: [],
  });
  const initialized = await user.rpc("initialize_workspace_snapshot", {
    target_workspace_id: workspaceId,
    target_schema_version: 3,
    target_snapshot: snapshot,
  });
  expect(initialized.error).toBeNull();
  const revision = await service
    .from("workspace_snapshots")
    .select("revision")
    .eq("workspace_id", workspaceId)
    .single();
  expect(revision.error).toBeNull();
  const proposals = [
    {
      id: randomUUID(),
      selected_text: quote,
      suggested_text: replacement,
      proposal_action: "replace",
      comment: "Replace multiline Markdown",
    },
    {
      id: randomUUID(),
      selected_text: anchor,
      suggested_text: insertion,
      proposal_action: "insert_after",
      comment: "Insert beside replacement",
    },
    {
      id: randomUUID(),
      selected_text: nested,
      suggested_text: null,
      proposal_action: "replace",
      comment: "Navigate collapsed branch",
    },
  ];
  const inserted = await service.from("knowledge_annotations").insert(
    proposals.map((proposal) => {
      const start = markdown.indexOf(proposal.selected_text);
      const end = start + proposal.selected_text.length;
      return {
        ...proposal,
        workspace_id: workspaceId,
        document_id: documentId,
        created_by: userId,
        kind: "agent",
        source_revision: revision.data!.revision,
        start_offset: start,
        end_offset: end,
        prefix: markdown.slice(Math.max(0, start - 96), start),
        suffix: markdown.slice(end, end + 96),
      };
    }),
  );
  expect(inserted.error).toBeNull();

  await page.goto("/sign-in?next=%2Fprototype%2Fdesktop");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль").fill(E2E_USER_PASSWORD);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(/\/prototype\/desktop$/);
  await page.goto(
    `/prototype/desktop?section=knowledge&document=${documentId}`,
  );
  const reading = page.locator(
    `.document-page.is-active-pane[data-document-id="${documentId}"]`,
  );
  await expect(
    reading.getByRole("heading", { name: "Review test", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Комментарии: 3 открытых", exact: true })
    .click();
  const panel = page.getByRole("complementary", {
    name: "Комментарии к статье",
    exact: true,
  });
  await panel
    .getByRole("group", { name: "Тип комментариев", exact: true })
    .getByRole("button", { name: "Нейро (3)", exact: true })
    .click();
  const card = (comment: string) =>
    panel.locator("article").filter({ hasText: comment });
  const first = card(proposals[0]!.comment);
  await first.locator('button[title="Перейти к фрагменту"]').click();
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toContain("template.json");
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toContain("Не меняй schema и поля.");

  for (const proposal of proposals.slice(0, 2)) {
    const response = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/knowledge-neurocomments/apply") &&
        response.request().postDataJSON()?.annotationId === proposal.id,
    );
    await card(proposal.comment)
      .getByRole("button", { name: "Принять", exact: true })
      .click();
    const accepted = await response;
    expect(accepted.status(), await accepted.text()).toBe(200);
    await expect(reading).toBeVisible();
    await expect(reading).toContainText("Новая структура template.json.");
    await expect(reading).toContainText("Сохранён второй абзац.");
  }
  await expect(reading).toContainText("Внедрённое дополнение.");
  await panel.getByRole("button", { name: /Решённые —/ }).click();
  await first.locator('button[title="Показать внедрённый текст"]').click();
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toContain("Сохранён второй абзац.");

  await reading
    .getByRole("button", { name: "Свернуть вложенный список", exact: true })
    .click();
  await expect(reading.getByText("Дочерняя", { exact: false })).toHaveCount(0);
  await card(proposals[2]!.comment)
    .locator('button[title="Перейти к фрагменту"]')
    .click();
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe("Дочерняя цитата для перехода.");
  await expect(reading.getByText("Дочерняя", { exact: false })).toBeVisible();
});
