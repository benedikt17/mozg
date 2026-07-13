export type ProjectSection =
  "overview" | "knowledge" | "tasks" | "canvases" | "inbox";

export type OverviewLane = "now" | "next" | "later" | "done";

export type TaskFilter =
  "all" | "today" | "important" | "upcoming" | "completed";

export type InboxFilter = "all" | "text" | "links" | "files" | "audio";

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

export type PrototypeDocument = {
  id: string;
  projectId: string;
  folder: string;
  folderPath?: string[];
  title: string;
  excerpt: string;
  content: string[];
  linkedTaskIds: string[];
  backlinks: string[];
};

export type CanvasObjectType = "note" | "shape" | "link";

export type PrototypeCanvasObject = {
  id: string;
  type: CanvasObjectType;
  title: string;
  body: string;
  x: number;
  y: number;
};

export type PrototypeCanvas = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  objects: PrototypeCanvasObject[];
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
    description: "Рубеж, активные задачи и короткое состояние проекта.",
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
    id: "inbox",
    label: "Входящие",
    description: "Захваченные материалы до превращения в знания или задачи.",
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

export const taskFilters: {
  id: TaskFilter;
  label: string;
  description: string;
}[] = [
  { id: "all", label: "Все", description: "Все задачи проекта." },
  { id: "today", label: "Сегодня", description: "Текущая активная работа." },
  { id: "important", label: "Важные", description: "Отмеченные звездой." },
  {
    id: "upcoming",
    label: "Предстоящие",
    description: "Следующие и отложенные задачи.",
  },
  {
    id: "completed",
    label: "Завершённые",
    description: "Недавно закрытые задачи.",
  },
];

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
    linkedDocumentIds: ["doc-l-nastenka", "doc-l-baba-yaga"],
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
    linkedDocumentIds: ["doc-l-first-chapter"],
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
    linkedDocumentIds: ["doc-l-geography", "doc-l-magic"],
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
    linkedDocumentIds: ["doc-l-scenes"],
    subtasks: [
      {
        id: "luko-shot-list-1",
        title: "Отобрать 12 референсов",
        done: true,
      },
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
    id: "luko-brief-done",
    projectId: "lukomorie",
    title: "Свести brief по текущей версии проекта",
    overviewLane: "done",
    starred: true,
    area: "Производство",
    milestoneId: "lukomorie-alpha",
    dueDate: "15 июл",
    linkedDocumentIds: ["doc-l-production"],
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
      {
        id: "ammonit-index-2",
        title: "Пометить спорные места",
        done: false,
      },
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
    id: "personal-calendar",
    projectId: "personal",
    title: "Убрать лишние обещания из календаря",
    overviewLane: "now",
    starred: true,
    area: "Неделя",
    milestoneId: "personal-week",
    linkedDocumentIds: ["doc-p-week"],
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
];

export const initialDocuments: PrototypeDocument[] = [
  {
    id: "doc-l-nastenka",
    projectId: "lukomorie",
    folder: "Персонажи",
    title: "Настенька",
    excerpt: "Главная точка зрения первой главы и её активная цель.",
    content: [
      "# Настенька",
      "Главная героиня не должна быть просто наблюдателем. В первой главе она принимает решение, которое запускает путешествие.",
      "- хочет сохранить связь с домом;",
      "- боится, что мир окажется набором чужих правил;",
      "- действует быстрее, чем успевает всё понять.",
    ],
    linkedTaskIds: ["luko-characters-map", "luko-first-scene"],
    backlinks: ["Баба Яга", "Первая глава"],
  },
  {
    id: "doc-l-baba-yaga",
    projectId: "lukomorie",
    folder: "Персонажи",
    title: "Баба Яга",
    excerpt: "Не злодей, а строгий проводник с собственной ценой помощи.",
    content: [
      "# Баба Яга",
      "Важна не страшность персонажа, а контракт: помощь всегда меняет маршрут героя.",
      "Связь с Кощеем должна выглядеть как старый спор, а не экспозиция.",
    ],
    linkedTaskIds: ["luko-characters-map"],
    backlinks: ["Кощей", "Правила магии"],
  },
  {
    id: "doc-l-koschei",
    projectId: "lukomorie",
    folder: "Персонажи",
    title: "Кощей",
    excerpt: "Антагонист, который защищает неподвижность мира.",
    content: [
      "# Кощей",
      "Главный конфликт строится вокруг страха изменений. Его бессмертие — не сила, а архитектурная проблема мира.",
    ],
    linkedTaskIds: ["luko-characters-map"],
    backlinks: ["Баба Яга", "Правила магии"],
  },
  {
    id: "doc-l-geography",
    projectId: "lukomorie",
    folder: "Мир",
    title: "География",
    excerpt: "Острова, переходы и правила расстояний.",
    content: [
      "# География",
      "Карта должна помогать сценам, а не становиться энциклопедией. Каждый переход между островами требует причины.",
    ],
    linkedTaskIds: ["luko-world-rules"],
    backlinks: ["Правила магии"],
  },
  {
    id: "doc-l-magic",
    projectId: "lukomorie",
    folder: "Мир",
    title: "Правила магии",
    excerpt: "Три ограничения, которые нельзя нарушать ради удобства сцены.",
    content: [
      "# Правила магии",
      "Магия работает только как обмен: время, память или маршрут. Это правило должно быть видно в действии.",
    ],
    linkedTaskIds: ["luko-world-rules"],
    backlinks: ["География", "Кощей"],
  },
  {
    id: "doc-l-first-chapter",
    projectId: "lukomorie",
    folder: "Сценарии",
    title: "Первая глава",
    excerpt: "Черновая структура первой главы.",
    content: [
      "# Первая глава",
      "Открываем не описанием мира, а ситуацией выбора. Экспозицию распаковываем через последствия.",
    ],
    linkedTaskIds: ["luko-first-scene"],
    backlinks: ["Настенька", "Сцены"],
  },
  {
    id: "doc-l-scenes",
    projectId: "lukomorie",
    folder: "Сценарии",
    title: "Сцены",
    excerpt: "Рабочий список сцен и визуальных ориентиров.",
    content: [
      "# Сцены",
      "Каждая сцена должна отвечать на вопрос: что изменилось после неё?",
    ],
    linkedTaskIds: ["luko-shot-list"],
    backlinks: ["Первая глава"],
  },
  {
    id: "doc-l-production",
    projectId: "lukomorie",
    folder: "Производство",
    title: "Минимальный цикл",
    excerpt: "Как не распухнуть до бесконечного планирования.",
    content: [
      "# Минимальный цикл",
      "На один рабочий цикл берём только то, что можно проверить видимым результатом.",
    ],
    linkedTaskIds: ["luko-production-plan", "luko-brief-done"],
    backlinks: ["Первая глава"],
  },
  {
    id: "doc-a-index",
    projectId: "ammonit",
    folder: "Исследование",
    title: "Индекс находок",
    excerpt: "Темы, источники и спорные места.",
    content: ["# Индекс находок", "Сначала факты, потом гипотезы."],
    linkedTaskIds: ["ammonit-index"],
    backlinks: ["Вопросы интервью"],
  },
  {
    id: "doc-a-questions",
    projectId: "ammonit",
    folder: "Исследование",
    title: "Вопросы интервью",
    excerpt: "Короткий список вопросов для следующего разговора.",
    content: [
      "# Вопросы интервью",
      "Оставить только вопросы, которые меняют вывод.",
    ],
    linkedTaskIds: ["ammonit-interview"],
    backlinks: ["Индекс находок"],
  },
  {
    id: "doc-v-script",
    projectId: "voice-studio",
    folder: "Сценарии",
    title: "Демо-сценарий",
    excerpt: "Двухминутный прогон для записи.",
    content: ["# Демо-сценарий", "Текст должен держаться на темпе и паузах."],
    linkedTaskIds: ["voice-script"],
    backlinks: [],
  },
  {
    id: "doc-p-week",
    projectId: "personal",
    folder: "Неделя",
    title: "План недели",
    excerpt: "Реальные обязательства без лишних обещаний.",
    content: ["# План недели", "Оставить только то, что действительно нужно."],
    linkedTaskIds: ["personal-calendar"],
    backlinks: [],
  },
];

const extraLukomorieDocuments: PrototypeDocument[] = [
  {
    id: "doc-l-kolenka",
    projectId: "lukomorie",
    folder: "Персонажи",
    folderPath: ["Персонажи", "Главные герои"],
    title: "Коленька",
    excerpt:
      "Герой, который проверяет бытовую сторону волшебного мира и цену обещаний.",
    content: [
      "# Коленька",
      "Коленька нужен не как комический спутник, а как персонаж, который видит, где сказочное правило ломает обычную человеческую договорённость.",
      "## Рабочая функция",
      "- спрашивает о практической цене переходов между островами;",
      "- первым замечает, что обещание Бабы Яги звучит как контракт;",
      "- удерживает Настеньку от решения, которое красиво выглядит в легенде, но плохо работает в сцене.",
      "Связанные заметки: [[Настенька]], [[Пути между островами]], [[Баба Яга]].",
    ],
    linkedTaskIds: ["luko-characters-map"],
    backlinks: ["Настенька", "Пути между островами"],
  },
  {
    id: "doc-l-denis",
    projectId: "lukomorie",
    folder: "Персонажи",
    folderPath: ["Персонажи", "Главные герои"],
    title: "Денис",
    excerpt:
      "Внешний рациональный голос, через которого проверяются правила мира.",
    content: [
      "# Денис",
      "Денис не должен объяснять магию напрямую. Он полезен там, где сцена требует сопротивления: кто-то должен сказать, что сказочное решение выглядит подозрительно удобным.",
      "## Риски",
      "Если Денис становится только голосом автора, он вынимает конфликт из действия. Его вопросы должны создавать выбор, а не лекцию.",
    ],
    linkedTaskIds: ["luko-characters-map"],
    backlinks: ["Настенька", "Правила магии"],
  },
  {
    id: "doc-l-leshy",
    projectId: "lukomorie",
    folder: "Персонажи",
    folderPath: ["Персонажи", "Волшебные существа"],
    title: "Леший",
    excerpt: "Хранитель границы леса: не враг, но проверка на внимательность.",
    content: [
      "# Леший",
      "Леший работает как интерфейс леса: он не запрещает идти дальше, но меняет стоимость пути. Его сцены должны быть короткими и почти бытовыми.",
      "- говорит загадками только тогда, когда это меняет действие;",
      "- знает карту троп, но не объясняет правила магии;",
      "- уважает точные просьбы и наказывает расплывчатые.",
    ],
    linkedTaskIds: ["luko-world-rules"],
    backlinks: ["Острова", "Пути между островами"],
  },
  {
    id: "doc-l-abyss-relationship",
    projectId: "lukomorie",
    folder: "Персонажи",
    folderPath: ["Персонажи", "Отношения"],
    title: "Настенька и тварь из бездны",
    excerpt:
      "Динамика страха, любопытства и запрета на прямое объяснение бездны.",
    content: [
      "# Настенька и тварь из бездны",
      "Связь должна оставаться напряжением, а не дружбой по умолчанию. Тварь из бездны показывает, что мир отвечает не только на просьбы, но и на внутреннее состояние героя.",
      "## Правило сцены",
      "Каждая встреча должна оставлять след: изменение маршрута, потерянный предмет или новую невозможность.",
    ],
    linkedTaskIds: ["luko-first-scene"],
    backlinks: ["Настенька", "Правила магии"],
  },
  {
    id: "doc-l-kolobok-role",
    projectId: "lukomorie",
    folder: "Персонажи",
    folderPath: ["Персонажи", "Отношения"],
    title: "Колобок и его роль",
    excerpt:
      "Не маскот, а индикатор тона: где история становится слишком тяжёлой.",
    content: [
      "# Колобок и его роль",
      "Колобок появляется в местах, где нужен сдвиг темпа. Он не должен отменять угрозу, но может показать, что герои ещё способны смеяться.",
      "Связанные заметки: [[Первая глава]], [[Список сцен]].",
    ],
    linkedTaskIds: ["luko-first-scene"],
    backlinks: ["Первая глава"],
  },
  {
    id: "doc-l-islands",
    projectId: "lukomorie",
    folder: "Мир",
    folderPath: ["Мир", "География"],
    title: "Острова",
    excerpt:
      "Набор локаций, которые отличаются не декором, а правилами действия.",
    content: [
      "# Острова",
      "Каждый остров должен иметь простое драматическое правило: что здесь можно сделать такого, чего нельзя сделать в другом месте.",
      "## Черновой список",
      "- остров-порог, где принимается первый контракт;",
      "- остров памяти, где маршрут зависит от забытых обещаний;",
      "- остров ремесла, где магия требует физической работы.",
    ],
    linkedTaskIds: ["luko-world-rules"],
    backlinks: ["Карта Лукоморья", "Пути между островами"],
  },
  {
    id: "doc-l-map",
    projectId: "lukomorie",
    folder: "Мир",
    folderPath: ["Мир", "География"],
    title: "Карта Лукоморья",
    excerpt:
      "Схема расстояний и запретов, которую можно будет вынести на canvas.",
    content: [
      "# Карта Лукоморья",
      "Карта — рабочий инструмент сценария. Она должна показывать, почему герои не могут просто пойти самым коротким путём.",
      "См. также: [[Острова]], [[Пути между островами]], [[Правила магии]].",
    ],
    linkedTaskIds: ["luko-shot-list"],
    backlinks: ["Острова"],
  },
  {
    id: "doc-l-routes",
    projectId: "lukomorie",
    folder: "Мир",
    folderPath: ["Мир", "География"],
    title: "Пути между островами",
    excerpt: "Черновые правила перемещения, цены и исключения.",
    content: [
      "# Пути между островами",
      "Переход между островами всегда забирает ресурс: время, память, голос или возможность вернуться тем же способом.",
      "## Нельзя",
      "- использовать переход как быстрый монтаж без цены;",
      "- объяснять правило после того, как оно уже спасло героя;",
      "- делать все маршруты одинаково опасными.",
    ],
    linkedTaskIds: ["luko-world-rules"],
    backlinks: ["Острова", "Правила магии"],
  },
  {
    id: "doc-l-world-history",
    projectId: "lukomorie",
    folder: "Мир",
    folderPath: ["Мир"],
    title: "История мира",
    excerpt: "Короткая хронология событий, которые влияют на текущие правила.",
    content: [
      "# История мира",
      "История мира нужна только там, где она создаёт сегодняшнее ограничение. Всё остальное остаётся в черновике.",
      "## Канон",
      "Старые договоры сильнее новых обещаний, но только если кто-то помнит точную формулировку.",
    ],
    linkedTaskIds: ["luko-world-rules"],
    backlinks: ["Правила магии"],
  },
  {
    id: "doc-l-second-chapter",
    projectId: "lukomorie",
    folder: "Сценарии",
    folderPath: ["Сценарии", "Первый сезон"],
    title: "Вторая глава",
    excerpt: "Проверка последствий первого выбора и расширение маршрута.",
    content: [
      "# Вторая глава",
      "Во второй главе герои должны почувствовать, что первое решение было не вступлением, а настоящим действием с последствиями.",
      "- вернуть цену первого перехода;",
      "- показать новый остров через задачу, а не описание;",
      "- связать Коленьку с практической проблемой маршрута.",
    ],
    linkedTaskIds: ["luko-first-scene"],
    backlinks: ["Первая глава", "Пути между островами"],
  },
  {
    id: "doc-l-scene-list",
    projectId: "lukomorie",
    folder: "Сценарии",
    folderPath: ["Сценарии", "Первый сезон"],
    title: "Список сцен",
    excerpt:
      "Рабочая последовательность сцен без финальной литературной формы.",
    content: [
      "# Список сцен",
      "Список сцен нужен как монтажная карта. Каждая строка должна отвечать на вопрос: что изменилось после сцены?",
      "1. Настенька принимает условие перехода.",
      "2. Коленька замечает бытовую цену магии.",
      "3. Леший показывает обходной путь, но требует точной просьбы.",
    ],
    linkedTaskIds: ["luko-first-scene", "luko-shot-list"],
    backlinks: ["Первая глава", "Колобок и его роль"],
  },
  {
    id: "doc-l-dialogues",
    projectId: "lukomorie",
    folder: "Сценарии",
    folderPath: ["Сценарии"],
    title: "Диалоги",
    excerpt: "Фразы, которые проверяют тон и отношения персонажей.",
    content: [
      "# Диалоги",
      "Диалог должен звучать так, будто персонажи решают проблему сейчас, а не рассказывают читателю правила.",
      "> «Если дорога просит имя, значит, она уже знает дорогу обратно».",
    ],
    linkedTaskIds: ["luko-first-scene"],
    backlinks: ["Настенька", "Коленька"],
  },
  {
    id: "doc-l-visual-dev",
    projectId: "lukomorie",
    folder: "Производство",
    folderPath: ["Производство"],
    title: "Визуальная разработка",
    excerpt:
      "Набор визуальных решений, которые можно связать с холстами и сценами.",
    content: [
      "# Визуальная разработка",
      "Визуальные ориентиры собираются вокруг функции сцены: карта, силуэт, объект-цена, изменение света.",
      "См. [[Карта Лукоморья]] и [[Список сцен]].",
    ],
    linkedTaskIds: ["luko-shot-list"],
    backlinks: ["Карта Лукоморья"],
  },
  {
    id: "doc-l-voice",
    projectId: "lukomorie",
    folder: "Производство",
    folderPath: ["Производство"],
    title: "Озвучка",
    excerpt:
      "Черновые требования к голосу, паузам и сказочному тону без мультяшности.",
    content: [
      "# Озвучка",
      "Голос должен держать сказочную ясность, но не превращать текст в пародию. Самое важное — паузы перед условиями договоров.",
    ],
    linkedTaskIds: ["luko-production-plan"],
    backlinks: ["Диалоги"],
  },
  {
    id: "doc-l-production-cycle",
    projectId: "lukomorie",
    folder: "Производство",
    folderPath: ["Производство"],
    title: "Производственный цикл",
    excerpt:
      "Как заметка проходит путь от сырой идеи до проверяемого результата.",
    content: [
      "# Производственный цикл",
      "Минимальный цикл: заметка → задача → сцена → проверяемый результат. Всё, что не проходит этот путь, остаётся справочным материалом.",
      "## Критерий",
      "У каждой заметки должен быть следующий рабочий шаг или причина оставаться архивной.",
    ],
    linkedTaskIds: ["luko-production-plan", "luko-brief-done"],
    backlinks: ["Минимальный цикл"],
  },
];

initialDocuments.push(...extraLukomorieDocuments);

export const initialCanvases: PrototypeCanvas[] = [
  {
    id: "canvas-l-characters",
    projectId: "lukomorie",
    title: "Персонажи",
    description: "Связи, цели и конфликты ключевых фигур.",
    objects: [
      {
        id: "obj-nastenka",
        type: "note",
        title: "Настенька",
        body: "Активное решение запускает первую главу.",
        x: 16,
        y: 18,
      },
      {
        id: "obj-baba-yaga",
        type: "shape",
        title: "Баба Яга",
        body: "Помощь как контракт, а не подарок.",
        x: 50,
        y: 32,
      },
      {
        id: "obj-koschei",
        type: "note",
        title: "Кощей",
        body: "Защищает неподвижность мира.",
        x: 32,
        y: 62,
      },
    ],
  },
  {
    id: "canvas-l-plot",
    projectId: "lukomorie",
    title: "Сюжет",
    description: "Причины, последствия и узкие места первой главы.",
    objects: [
      {
        id: "obj-choice",
        type: "shape",
        title: "Первый выбор",
        body: "Сцена начинается с действия.",
        x: 18,
        y: 24,
      },
      {
        id: "obj-cost",
        type: "note",
        title: "Цена перехода",
        body: "Каждый переход что-то забирает.",
        x: 56,
        y: 48,
      },
    ],
  },
  {
    id: "canvas-l-relations",
    projectId: "lukomorie",
    title: "Отношения",
    description: "Кто на кого влияет в первой главе.",
    objects: [
      {
        id: "obj-mentor",
        type: "link",
        title: "Наставник ↔ герой",
        body: "Напряжение должно быть видно в сценах.",
        x: 42,
        y: 38,
      },
    ],
  },
  {
    id: "canvas-l-production",
    projectId: "lukomorie",
    title: "Производство",
    description: "Минимальный цикл от заметки до проверяемого результата.",
    objects: [
      {
        id: "obj-cycle",
        type: "shape",
        title: "Цикл",
        body: "Заметка → задача → сцена → проверка.",
        x: 30,
        y: 36,
      },
    ],
  },
  {
    id: "canvas-a-research",
    projectId: "ammonit",
    title: "Исследование",
    description: "Карта источников и вопросов.",
    objects: [
      {
        id: "obj-source",
        type: "note",
        title: "Источник",
        body: "Факт отдельно от вывода.",
        x: 24,
        y: 30,
      },
    ],
  },
  {
    id: "canvas-v-demo",
    projectId: "voice-studio",
    title: "Демо",
    description: "Темп, паузы и структура записи.",
    objects: [
      {
        id: "obj-tempo",
        type: "shape",
        title: "Темп",
        body: "Пауза важнее скорости.",
        x: 36,
        y: 44,
      },
    ],
  },
  {
    id: "canvas-p-week",
    projectId: "personal",
    title: "Неделя",
    description: "Лёгкая карта обязательств.",
    objects: [
      {
        id: "obj-week",
        type: "note",
        title: "Неделя",
        body: "Убрать лишнее.",
        x: 34,
        y: 34,
      },
    ],
  },
];

export const initialInboxItems: PrototypeInboxItem[] = [
  {
    id: "inbox-l-text",
    projectId: "lukomorie",
    kind: "text",
    title: "Фраза для первой сцены",
    preview: "Открыть главу с решения, а не с карты мира.",
    source: "Быстрый текст",
    capturedAt: "Сегодня 10:20",
  },
  {
    id: "inbox-l-link",
    projectId: "lukomorie",
    kind: "links",
    title: "Референс островной деревни",
    preview: "URL с визуальными ориентирами для первой локации.",
    source: "Ссылка",
    capturedAt: "Вчера 18:40",
  },
  {
    id: "inbox-l-file",
    projectId: "lukomorie",
    kind: "files",
    title: "Черновой PDF с именами",
    preview: "Нужно разобрать на персонажей и топонимы.",
    source: "Файл",
    capturedAt: "12 июл 21:15",
  },
  {
    id: "inbox-l-audio",
    projectId: "lukomorie",
    kind: "audio",
    title: "Голосовая мысль про Кощея",
    preview: "Идея: бессмертие как страх изменений.",
    source: "Аудио",
    capturedAt: "12 июл 09:30",
  },
  {
    id: "inbox-a-text",
    projectId: "ammonit",
    kind: "text",
    title: "Вопрос про источник",
    preview: "Проверить, где впервые встречается спорная формулировка.",
    source: "Быстрый текст",
    capturedAt: "Сегодня 11:05",
  },
  {
    id: "inbox-v-audio",
    projectId: "voice-studio",
    kind: "audio",
    title: "Пробная интонация",
    preview: "Сравнить спокойный и энергичный вариант.",
    source: "Аудио",
    capturedAt: "Вчера 22:10",
  },
  {
    id: "inbox-p-link",
    projectId: "personal",
    kind: "links",
    title: "Список бытовых дел",
    preview: "Разобрать, что действительно нужно на этой неделе.",
    source: "Ссылка",
    capturedAt: "Сегодня 08:45",
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
