export type ProjectSection =
  "overview" | "knowledge" | "tasks" | "canvases" | "inbox";

export type OverviewLane = "now" | "next" | "later" | "done";

export type PrototypeProject = {
  id: string;
  name: string;
  shortName: string;
  description: string;
};

export type PrototypeMilestone = {
  id: string;
  projectId: string;
  title: string;
  description: string;
};

export type PrototypeSubtask = {
  id: string;
  title: string;
  done: boolean;
};

export type PrototypeTask = {
  id: string;
  projectId: string;
  title: string;
  overviewLane: OverviewLane;
  starred: boolean;
  area?: string;
  milestoneId?: string;
  dueDate?: string;
  linkedDocumentIds: string[];
  subtasks: PrototypeSubtask[];
  notes?: string;
};

export type AiProposal = {
  id: string;
  title: string;
  description: string;
  kind:
    | "clarify-task"
    | "create-next-step"
    | "move-to-milestone"
    | "add-question"
    | "find-documents";
};

export const projectSections: {
  id: ProjectSection;
  label: string;
  description: string;
}[] = [
  {
    id: "overview",
    label: "Обзор",
    description: "Движение проекта, ближайшие задачи и текущий рубеж.",
  },
  {
    id: "knowledge",
    label: "Знания",
    description: "Дерево документов, вкладки, Markdown и wiki-связи.",
  },
  {
    id: "tasks",
    label: "Задачи",
    description:
      "Фильтры, список задач и детальная работа с выбранной задачей.",
  },
  {
    id: "canvases",
    label: "Холсты",
    description: "Список холстов и рабочее пространство tldraw.",
  },
  {
    id: "inbox",
    label: "Входящие",
    description: "Место для быстрых захватов. Детальный workflow отложен.",
  },
];

export const overviewLanes: {
  id: OverviewLane;
  label: string;
  hint: string;
}[] = [
  {
    id: "now",
    label: "Сейчас",
    hint: "Работа, которая действительно активна.",
  },
  {
    id: "next",
    label: "Дальше",
    hint: "Логичные следующие действия.",
  },
  {
    id: "later",
    label: "Позже",
    hint: "Важно, но пока не стало текущим.",
  },
  {
    id: "done",
    label: "Готово",
    hint: "Недавно завершённое, без всей истории проекта.",
  },
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
    description: "Личные дела без отдельной архитектуры.",
  },
];

export const initialMilestones: PrototypeMilestone[] = [
  {
    id: "lukomorie-alpha",
    projectId: "lukomorie",
    title: "Собрать основу первой главы",
    description:
      "Превратить разрозненные материалы в рабочий набор сцен, персонажей и визуальных ориентиров.",
  },
  {
    id: "lukomorie-world",
    projectId: "lukomorie",
    title: "Зафиксировать правила мира",
    description:
      "Убрать противоречия в географии, магии и правилах путешествий.",
  },
  {
    id: "ammonit-research",
    projectId: "ammonit",
    title: "Свести исследовательские заметки",
    description: "Отделить факты, гипотезы и вопросы для следующего интервью.",
  },
  {
    id: "voice-demo",
    projectId: "voice-studio",
    title: "Подготовить демо-сессию",
    description: "Собрать сценарий, прогон и список технических проверок.",
  },
  {
    id: "personal-week",
    projectId: "personal",
    title: "Навести порядок недели",
    description: "Оставить только реальные обязательства и ближайшие действия.",
  },
];

export const initialTasks: PrototypeTask[] = [
  {
    id: "luko-characters-map",
    projectId: "lukomorie",
    title: "Собрать карту мотиваций ключевых персонажей",
    overviewLane: "now",
    starred: true,
    area: "Персонажи",
    milestoneId: "lukomorie-alpha",
    dueDate: "18 июл",
    linkedDocumentIds: ["doc-l-characters", "doc-l-conflicts"],
    subtasks: [
      {
        id: "luko-characters-map-1",
        title: "Выделить главную цель героя",
        done: true,
      },
      {
        id: "luko-characters-map-2",
        title: "Проверить конфликт наставника",
        done: false,
      },
      {
        id: "luko-characters-map-3",
        title: "Уточнить роль антагониста",
        done: false,
      },
    ],
    notes:
      "Нужно убрать ощущение списка имён и показать, кто реально двигает историю.",
  },
  {
    id: "luko-first-scene",
    projectId: "lukomorie",
    title: "Переписать вход в первую сцену через действие",
    overviewLane: "now",
    starred: false,
    area: "Сценарии",
    milestoneId: "lukomorie-alpha",
    dueDate: "19 июл",
    linkedDocumentIds: ["doc-l-scene-1"],
    subtasks: [
      {
        id: "luko-first-scene-1",
        title: "Убрать вступительное объяснение",
        done: true,
      },
      {
        id: "luko-first-scene-2",
        title: "Добавить видимую ставку",
        done: false,
      },
    ],
    notes: "Сцена должна начинаться с выбора, а не с описания мира.",
  },
  {
    id: "luko-world-rules",
    projectId: "lukomorie",
    title: "Согласовать три правила путешествия между островами",
    overviewLane: "next",
    starred: true,
    area: "Мир",
    milestoneId: "lukomorie-world",
    dueDate: "22 июл",
    linkedDocumentIds: ["doc-l-world", "doc-l-map"],
    subtasks: [
      {
        id: "luko-world-rules-1",
        title: "Найти противоречия в заметках",
        done: false,
      },
      {
        id: "luko-world-rules-2",
        title: "Записать короткую финальную формулировку",
        done: false,
      },
    ],
  },
  {
    id: "luko-shot-list",
    projectId: "lukomorie",
    title: "Собрать визуальные референсы для первой локации",
    overviewLane: "next",
    starred: false,
    area: "Визуальная разработка",
    milestoneId: "lukomorie-alpha",
    linkedDocumentIds: ["doc-l-visual"],
    subtasks: [
      { id: "luko-shot-list-1", title: "Отобрать 12 референсов", done: true },
      {
        id: "luko-shot-list-2",
        title: "Разнести по настроению и функции",
        done: false,
      },
    ],
  },
  {
    id: "luko-production-plan",
    projectId: "lukomorie",
    title: "Определить минимальный производственный цикл",
    overviewLane: "later",
    starred: false,
    area: "Производство",
    milestoneId: "lukomorie-alpha",
    linkedDocumentIds: ["doc-l-production"],
    subtasks: [
      {
        id: "luko-production-plan-1",
        title: "Оценить один рабочий спринт",
        done: false,
      },
      {
        id: "luko-production-plan-2",
        title: "Отделить сценарную работу от визуальной",
        done: false,
      },
    ],
  },
  {
    id: "luko-plot-thread",
    projectId: "lukomorie",
    title: "Проверить, где теряется сюжетная причина путешествия",
    overviewLane: "later",
    starred: true,
    area: "Сюжет",
    milestoneId: "lukomorie-world",
    linkedDocumentIds: ["doc-l-plot"],
    subtasks: [
      {
        id: "luko-plot-thread-1",
        title: "Собрать все упоминания причины",
        done: false,
      },
    ],
  },
  {
    id: "luko-brief-done",
    projectId: "lukomorie",
    title: "Свести brief по текущей версии проекта",
    overviewLane: "done",
    starred: true,
    area: "Производство",
    milestoneId: "lukomorie-alpha",
    dueDate: "15 июл",
    linkedDocumentIds: ["doc-l-brief"],
    subtasks: [
      { id: "luko-brief-done-1", title: "Собрать цели", done: true },
      {
        id: "luko-brief-done-2",
        title: "Убрать черновые формулировки",
        done: true,
      },
    ],
  },
  {
    id: "luko-names-done",
    projectId: "lukomorie",
    title: "Разобрать черновой список имён",
    overviewLane: "done",
    starred: false,
    area: "Персонажи",
    milestoneId: "lukomorie-alpha",
    linkedDocumentIds: ["doc-l-names"],
    subtasks: [
      {
        id: "luko-names-done-1",
        title: "Оставить рабочие варианты",
        done: true,
      },
    ],
  },
  {
    id: "ammonit-index",
    projectId: "ammonit",
    title: "Разложить находки по темам",
    overviewLane: "now",
    starred: true,
    area: "Исследование",
    milestoneId: "ammonit-research",
    dueDate: "20 июл",
    linkedDocumentIds: ["doc-a-index"],
    subtasks: [
      {
        id: "ammonit-index-1",
        title: "Отделить источники от выводов",
        done: false,
      },
      { id: "ammonit-index-2", title: "Пометить спорные места", done: false },
    ],
  },
  {
    id: "ammonit-interview",
    projectId: "ammonit",
    title: "Подготовить вопросы для следующего разговора",
    overviewLane: "next",
    starred: false,
    area: "Интервью",
    milestoneId: "ammonit-research",
    linkedDocumentIds: ["doc-a-questions"],
    subtasks: [
      {
        id: "ammonit-interview-1",
        title: "Сократить до пяти вопросов",
        done: false,
      },
    ],
  },
  {
    id: "ammonit-summary",
    projectId: "ammonit",
    title: "Собрать короткое резюме исследования",
    overviewLane: "done",
    starred: false,
    area: "Исследование",
    milestoneId: "ammonit-research",
    linkedDocumentIds: ["doc-a-summary"],
    subtasks: [
      { id: "ammonit-summary-1", title: "Проверить формулировки", done: true },
    ],
  },
  {
    id: "voice-script",
    projectId: "voice-studio",
    title: "Сократить сценарий демо до двух минут",
    overviewLane: "now",
    starred: true,
    area: "Сценарий",
    milestoneId: "voice-demo",
    dueDate: "17 июл",
    linkedDocumentIds: ["doc-v-script"],
    subtasks: [
      {
        id: "voice-script-1",
        title: "Убрать длинный вступительный блок",
        done: true,
      },
      {
        id: "voice-script-2",
        title: "Оставить один пример интонации",
        done: false,
      },
    ],
  },
  {
    id: "voice-check",
    projectId: "voice-studio",
    title: "Проверить микрофон и шум комнаты",
    overviewLane: "next",
    starred: false,
    area: "Запись",
    milestoneId: "voice-demo",
    linkedDocumentIds: [],
    subtasks: [
      { id: "voice-check-1", title: "Сделать тестовую запись", done: false },
    ],
  },
  {
    id: "voice-demo-done",
    projectId: "voice-studio",
    title: "Выбрать рабочий темп речи",
    overviewLane: "done",
    starred: false,
    area: "Практика",
    milestoneId: "voice-demo",
    linkedDocumentIds: ["doc-v-tempo"],
    subtasks: [
      { id: "voice-demo-done-1", title: "Прослушать три варианта", done: true },
    ],
  },
  {
    id: "personal-calendar",
    projectId: "personal",
    title: "Убрать лишние обещания из календаря",
    overviewLane: "now",
    starred: true,
    area: "Неделя",
    milestoneId: "personal-week",
    linkedDocumentIds: [],
    subtasks: [
      {
        id: "personal-calendar-1",
        title: "Проверить повторяющиеся события",
        done: false,
      },
      {
        id: "personal-calendar-2",
        title: "Оставить реальные обязательства",
        done: false,
      },
    ],
  },
  {
    id: "personal-note",
    projectId: "personal",
    title: "Собрать короткий список бытовых дел",
    overviewLane: "next",
    starred: false,
    area: "Дом",
    milestoneId: "personal-week",
    linkedDocumentIds: ["doc-p-week"],
    subtasks: [
      {
        id: "personal-note-1",
        title: "Отделить срочное от желательного",
        done: false,
      },
    ],
  },
  {
    id: "personal-done",
    projectId: "personal",
    title: "Закрыть старые напоминания",
    overviewLane: "done",
    starred: false,
    area: "Неделя",
    milestoneId: "personal-week",
    linkedDocumentIds: [],
    subtasks: [
      { id: "personal-done-1", title: "Удалить неактуальное", done: true },
    ],
  },
];

export const aiProposals: AiProposal[] = [
  {
    id: "clarify-task",
    kind: "clarify-task",
    title: "Уточнить расплывчатую задачу",
    description:
      "Добавить критерий готовности к выбранной или первой активной задаче.",
  },
  {
    id: "create-next-step",
    kind: "create-next-step",
    title: "Создать недостающий следующий шаг",
    description:
      "Добавить компактную задачу в колонку «Дальше» текущего проекта.",
  },
  {
    id: "move-to-milestone",
    kind: "move-to-milestone",
    title: "Вернуть задачу в текущий рубеж",
    description:
      "Привязать выбранную задачу к активному milestone и оставить её видимой.",
  },
  {
    id: "add-question",
    kind: "add-question",
    title: "Зафиксировать нерешённый вопрос",
    description: "Добавить видимую заметку-вопрос в контекст AI-панели.",
  },
  {
    id: "find-documents",
    kind: "find-documents",
    title: "Найти связанные документы",
    description: "Показать mock-связи с документами без изменения базы.",
  },
];
