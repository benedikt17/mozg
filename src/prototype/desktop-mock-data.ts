export type ProjectSection =
  | "overview"
  | "knowledge"
  | "tasks"
  | "canvases"
  | "files"
  | "inbox";

export type OverviewDirectionId = string;

export type TaskSignal = "none" | "green" | "yellow" | "red";

export type InboxFilter = "all" | "text" | "links" | "files" | "audio";

export type PrototypeProject = {
  id: string;
  name: string;
  shortName: string;
  description: string;
};

export type PrototypeOverviewDirection = {
  id: OverviewDirectionId;
  projectId: string;
  title: string;
  order: number;
};

export type PrototypeSubtask = {
  id: string;
  title: string;
  done: boolean;
  detailsMarkdown: string;
};

export type PrototypeTaskGroupKind = "system" | "user";

export type PrototypeTaskListKind = "system" | "user";

export type PrototypeTaskGroup = {
  id: string;
  projectId: string;
  title: string;
  order: number;
  kind: PrototypeTaskGroupKind;
};

export type PrototypeTaskList = {
  id: string;
  projectId: string;
  groupId: string;
  title: string;
  order: number;
  kind: PrototypeTaskListKind;
  overviewDirectionId?: OverviewDirectionId;
};

export type PrototypeTaskLink = {
  id: string;
  title: string;
  url: string;
};

export type PrototypeTask = {
  id: string;
  projectId: string;
  title: string;
  overviewDirectionId: OverviewDirectionId;
  overviewOrder: number;
  taskListOrder: number;
  listId: string;
  showOnOverview: boolean;
  completedAt: string | null;
  signal: TaskSignal;
  starred: boolean;
  myDay: boolean;
  area?: string;
  dueDate?: string;
  links: PrototypeTaskLink[];
  linkedDocumentIds: string[];
  subtasks: PrototypeSubtask[];
  notes?: string;
};

export type PrototypeDocument = {
  id: string;
  projectId: string;
  order?: number;
  folder: string;
  folderPath?: string[];
  deletedAt?: string;
  isKeyDocument?: boolean;
  title: string;
  excerpt: string;
  content: string[];
  backlinks: string[];
};

export type PrototypeInboxItem = {
  id: string;
  projectId: string;
  kind: Exclude<InboxFilter, "all">;
  title: string;
  preview: string;
  source: string;
  capturedAt: string;
};

export type AiProposal = {
  id: string;
  title: string;
  description: string;
  kind: "clarify-task" | "create-next-step" | "add-question" | "find-documents";
};

export const projectSections: {
  id: ProjectSection;
  label: string;
  description: string;
}[] = [
  {
    id: "overview",
    label: "Обзор",
    description: "Главные рабочие направления проекта и их текущие задачи.",
  },
  {
    id: "knowledge",
    label: "Знания",
    description: "Дерево документов, открытая заметка и контекст связей.",
  },
  {
    id: "tasks",
    label: "Задачи",
    description: "Единый список задач с простыми рабочими фильтрами.",
  },
  {
    id: "canvases",
    label: "Холсты",
    description: "Пространство схем, объектов и отношений проекта.",
  },
  {
    id: "files",
    label: "Файлы",
    description: "Папки и оригиналы файлов текущего проекта.",
  },
  {
    id: "inbox",
    label: "Входящие",
    description: "Захваченные материалы до превращения в знания или задачи.",
  },
];

export const publicProjectSections = projectSections.filter(({ id }) =>
  ["overview", "knowledge", "tasks", "canvases", "files"].includes(id),
);

export function isPublicProjectSection(section: ProjectSection): boolean {
  return publicProjectSections.some((item) => item.id === section);
}

export const inboxFilters: {
  id: InboxFilter;
  label: string;
}[] = [
  { id: "all", label: "Все" },
  { id: "text", label: "Текст" },
  { id: "links", label: "Ссылки" },
  { id: "files", label: "Файлы" },
  { id: "audio", label: "Аудио" },
];

export const initialProjects: PrototypeProject[] = [
  {
    id: "lukomorie",
    name: "Лукоморье",
    shortName: "Лукоморье",
    description: "Большой долгосрочный проект: мир, персонажи и производство.",
  },
  {
    id: "ammonit",
    name: "Аммонит",
    shortName: "Аммонит",
    description: "Исследовательский проект с материалами и рабочими заметками.",
  },
  {
    id: "voice-studio",
    name: "Voice Studio",
    shortName: "Voice",
    description: "Практика голоса, сценариев и записи.",
  },
  {
    id: "personal",
    name: "Личное",
    shortName: "Личное",
    description: "Персональные заметки, задачи и материалы.",
  },
];

export const initialOverviewDirections: PrototypeOverviewDirection[] = [
  {
    id: "direction-lukomorie",
    projectId: "lukomorie",
    title: "Лукоморье",
    order: 0,
  },
  {
    id: "direction-characters",
    projectId: "lukomorie",
    title: "Персонажи",
    order: 1,
  },
  {
    id: "direction-russian-style",
    projectId: "lukomorie",
    title: "Русский стиль",
    order: 2,
  },
  {
    id: "direction-mozg",
    projectId: "lukomorie",
    title: "MOZG",
    order: 3,
  },
  {
    id: "direction-ammonit",
    projectId: "ammonit",
    title: "Аммонит",
    order: 0,
  },
  {
    id: "direction-voice",
    projectId: "voice-studio",
    title: "Voice Studio",
    order: 0,
  },
  {
    id: "direction-personal",
    projectId: "personal",
    title: "Личное",
    order: 0,
  },
];

export const initialTaskGroups: PrototypeTaskGroup[] = [
  {
    id: "group-lukomorie-system",
    projectId: "lukomorie",
    title: "База",
    order: 0,
    kind: "system",
  },
  {
    id: "group-ammonit-system",
    projectId: "ammonit",
    title: "База",
    order: 0,
    kind: "system",
  },
  {
    id: "group-voice-system",
    projectId: "voice-studio",
    title: "База",
    order: 0,
    kind: "system",
  },
  {
    id: "group-personal-system",
    projectId: "personal",
    title: "База",
    order: 0,
    kind: "system",
  },
];

export const initialTaskLists: PrototypeTaskList[] = [
  {
    id: "list-lukomorie-inbox",
    projectId: "lukomorie",
    groupId: "group-lukomorie-system",
    title: "Входящие",
    order: 0,
    kind: "system",
  },
  {
    id: "list-lukomorie-all",
    projectId: "lukomorie",
    groupId: "group-lukomorie-system",
    title: "Все",
    order: 1,
    kind: "system",
  },
  {
    id: "list-ammonit-inbox",
    projectId: "ammonit",
    groupId: "group-ammonit-system",
    title: "Входящие",
    order: 0,
    kind: "system",
  },
  {
    id: "list-ammonit-all",
    projectId: "ammonit",
    groupId: "group-ammonit-system",
    title: "Все",
    order: 1,
    kind: "system",
  },
  {
    id: "list-voice-inbox",
    projectId: "voice-studio",
    groupId: "group-voice-system",
    title: "Входящие",
    order: 0,
    kind: "system",
  },
  {
    id: "list-voice-all",
    projectId: "voice-studio",
    groupId: "group-voice-system",
    title: "Все",
    order: 1,
    kind: "system",
  },
  {
    id: "list-personal-inbox",
    projectId: "personal",
    groupId: "group-personal-system",
    title: "Входящие",
    order: 0,
    kind: "system",
  },
  {
    id: "list-personal-all",
    projectId: "personal",
    groupId: "group-personal-system",
    title: "Все",
    order: 1,
    kind: "system",
  },
];

export const initialTasks: PrototypeTask[] = [
  {
    id: "task-lukomorie-registration",
    projectId: "lukomorie",
    title: "Регистрация торгового",
    overviewDirectionId: "direction-lukomorie",
    overviewOrder: 0,
    taskListOrder: 0,
    listId: "list-lukomorie-all",
    showOnOverview: true,
    completedAt: null,
    signal: "none",
    starred: false,
    myDay: false,
    area: "Бренд",
    links: [],
    linkedDocumentIds: [],
    subtasks: [],
  },
  {
    id: "task-lukomorie-sync",
    projectId: "lukomorie",
    title: "Проверить синхронизацию звука, губ и мимики",
    overviewDirectionId: "direction-lukomorie",
    overviewOrder: 1,
    taskListOrder: 1,
    listId: "list-lukomorie-all",
    showOnOverview: true,
    completedAt: null,
    signal: "none",
    starred: false,
    myDay: false,
    area: "Производство",
    links: [],
    linkedDocumentIds: [],
    subtasks: [],
  },
  {
    id: "task-lukomorie-baza-koschey",
    projectId: "lukomorie",
    title: "BAZA img Кощей 234324",
    overviewDirectionId: "direction-lukomorie",
    overviewOrder: 2,
    taskListOrder: 2,
    listId: "list-lukomorie-all",
    showOnOverview: true,
    completedAt: null,
    signal: "none",
    starred: true,
    myDay: false,
    area: "Персонажи",
    links: [],
    linkedDocumentIds: [],
    subtasks: [],
  },
  {
    id: "task-lukomorie-baza-yaga",
    projectId: "lukomorie",
    title: "BAZA img Яга",
    overviewDirectionId: "direction-lukomorie",
    overviewOrder: 3,
    taskListOrder: 3,
    listId: "list-lukomorie-all",
    showOnOverview: true,
    completedAt: null,
    signal: "none",
    starred: true,
    myDay: false,
    area: "Персонажи",
    links: [],
    linkedDocumentIds: [],
    subtasks: [],
  },
  {
    id: "task-lukomorie-social",
    projectId: "lukomorie",
    title: "Социальные сети. Регистрация аккаунтов",
    overviewDirectionId: "direction-lukomorie",
    overviewOrder: 4,
    taskListOrder: 4,
    listId: "list-lukomorie-all",
    showOnOverview: true,
    completedAt: null,
    signal: "none",
    starred: false,
    myDay: false,
    area: "Маркетинг",
    links: [],
    linkedDocumentIds: [],
    subtasks: [],
  },
  {
    id: "task-lukomorie-dobrynya",
    projectId: "lukomorie",
    title: "BAZA img Добрыня",
    overviewDirectionId: "direction-lukomorie",
    overviewOrder: 5,
    taskListOrder: 5,
    listId: "list-lukomorie-all",
    showOnOverview: true,
    completedAt: null,
    signal: "none",
    starred: false,
    myDay: false,
    area: "Персонажи",
    links: [],
    linkedDocumentIds: [],
    subtasks: [],
  },
];

export const initialDocuments: PrototypeDocument[] = [
  {
    id: "doc-l-nastenka",
    projectId: "lukomorie",
    folder: "Персонажи",
    folderPath: ["Персонажи", "Главные герои"],
    isKeyDocument: true,
    title: "Настенька",
    excerpt: "Героиня, которая соединяет сказочную логику и современный взгляд.",
    content: ["# Настенька", "Главная героиня проекта."],
    backlinks: [],
  },
  {
    id: "doc-l-baba-yaga",
    projectId: "lukomorie",
    folder: "Персонажи",
    folderPath: ["Персонажи", "Главные герои"],
    title: "Баба Яга",
    excerpt: "Опорный документ о характере, роли и визуальном языке персонажа.",
    content: ["# Баба Яга", "Черновой материал."],
    backlinks: [],
  },
  {
    id: "doc-l-magic",
    projectId: "lukomorie",
    folder: "Мир",
    folderPath: ["Мир", "Правила"],
    title: "Магия",
    excerpt: "Правила, ограничения и последствия магии.",
    content: ["# Магия", "Черновой материал."],
    backlinks: [],
  },
  {
    id: "doc-l-scene-list",
    projectId: "lukomorie",
    folder: "Сценарии",
    folderPath: ["Сценарии", "Первый сезон"],
    title: "Список сцен",
    excerpt: "Карта сцен первого сезона.",
    content: ["# Список сцен", "Черновой материал."],
    backlinks: [],
  },
  {
    id: "doc-l-routes",
    projectId: "lukomorie",
    folder: "Мир",
    folderPath: ["Мир", "География"],
    title: "Маршруты",
    excerpt: "Дороги, переходы и логика перемещения между ключевыми локациями.",
    content: ["# Маршруты", "Черновой материал."],
    backlinks: [],
  },
];

export const initialInboxItems: PrototypeInboxItem[] = [
  {
    id: "inbox-l-text",
    projectId: "lukomorie",
    kind: "text",
    title: "Фраза для сцены",
    preview: "Проверить реплику Кощея перед финальной сценой.",
    source: "Быстрый ввод",
    capturedAt: "Сегодня, 09:40",
  },
];

export const aiProposals: AiProposal[] = [
  {
    id: "proposal-1",
    title: "Уточнить критерий готовности",
    description: "Добавить к задаче короткий критерий результата.",
    kind: "clarify-task",
  },
  {
    id: "proposal-2",
    title: "Создать следующий шаг",
    description: "Выделить ближайшее действие в отдельную задачу.",
    kind: "create-next-step",
  },
  {
    id: "proposal-3",
    title: "Добавить вопрос",
    description: "Зафиксировать открытый вопрос по текущему материалу.",
    kind: "add-question",
  },
  {
    id: "proposal-4",
    title: "Найти связанные документы",
    description: "Подобрать документы из базы знаний по контексту.",
    kind: "find-documents",
  },
];

export function createCanonicalOverviewDirections(
  projectId: string,
): PrototypeOverviewDirection[] {
  return [
    {
      id: `direction-${projectId}`,
      projectId,
      title: "Проект",
      order: 0,
    },
  ];
}
