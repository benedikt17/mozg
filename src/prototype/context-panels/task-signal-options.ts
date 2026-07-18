import type { TaskSignal } from "@/prototype/desktop-mock-data";

export const taskSignalOptions: {
  id: TaskSignal;
  label: string;
}[] = [
  { id: "none", label: "Без сигнала" },
  { id: "green", label: "Зелёный" },
  { id: "yellow", label: "Жёлтый" },
  { id: "red", label: "Красный" },
];
