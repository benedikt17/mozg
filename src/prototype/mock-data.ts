export type ProjectArea = "notes" | "tasks" | "canvas";
export type Section = "inbox" | "today" | "projects" | "archive";

export type PrototypeNote = {
  id: string;
  projectId: string;
  title: string;
  body: string;
  edited: string;
  archived: boolean;
};

export type PrototypeProject = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  archived: boolean;
};

export const initialProjects: PrototypeProject[] = [
  {
    id: "lukomorye",
    name: "Лукоморье",
    emoji: "🌲",
    color: "#47735b",
    archived: false,
  },
  {
    id: "product",
    name: "Продукт",
    emoji: "◫",
    color: "#6677a8",
    archived: false,
  },
  {
    id: "personal",
    name: "Личное",
    emoji: "⌂",
    color: "#a46f55",
    archived: false,
  },
  {
    id: "empty",
    name: "Новый замысел",
    emoji: "◇",
    color: "#8a829c",
    archived: false,
  },
  {
    id: "old-site",
    name: "Старый сайт",
    emoji: "□",
    color: "#868686",
    archived: true,
  },
];

export const initialNotes: PrototypeNote[] = [
  {
    id: "roadmap",
    projectId: "lukomorye",
    title: "План развития Лукоморья",
    body: "## Фокус недели\n\nСобрать спокойное рабочее пространство без визуального шума.\n\n- [x] Проверить навигацию\n- [ ] Обсудить структуру проектов\n\nСвязано с [[Исследование редактора]].",
    edited: "2 мин назад",
    archived: false,
  },
  {
    id: "editor-research",
    projectId: "lukomorye",
    title: "Исследование редактора: ширина, ритм и спокойствие длинной сессии",
    body: "# Исследование редактора\n\nОсновная колонка должна оставаться читаемой и не прыгать при переключении заметок.\n\n`Cmd+K` открывает быстрый поиск.",
    edited: "вчера",
    archived: false,
  },
  {
    id: "meeting",
    projectId: "lukomorye",
    title: "Встреча",
    body: "Короткая заметка для проверки плотности списка.",
    edited: "3 дня назад",
    archived: false,
  },
  {
    id: "launch",
    projectId: "product",
    title: "Сценарий первого запуска",
    body: "## Первый запуск\n\nПользователь сразу понимает, где создать заметку.",
    edited: "сегодня",
    archived: false,
  },
  {
    id: "archived-note",
    projectId: "personal",
    title: "Старый список книг",
    body: "Архивная заметка.",
    edited: "12 июня",
    archived: true,
  },
];

export const inboxItems = [
  {
    id: "i1",
    kind: "Текст",
    icon: "T",
    title: "Идея: связать Today с ежедневной заметкой",
  },
  {
    id: "i2",
    kind: "Голос",
    icon: "◉",
    title: "Запись · 01:24 — мысли после встречи",
  },
  {
    id: "i3",
    kind: "Изображение",
    icon: "▧",
    title: "Снимок доски с планом релиза",
  },
  {
    id: "i4",
    kind: "Ссылка",
    icon: "↗",
    title: "Статья о спокойных интерфейсах",
  },
];
