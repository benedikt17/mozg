import React from "react";

export function EmptySection({ title }: { title: string }): React.JSX.Element {
  return (
    <section className="empty-section">
      <span>{title}</span>
      <h1>Нет mock-данных</h1>
      <p>Этот проект пока показывает только структуру зоны.</p>
    </section>
  );
}
