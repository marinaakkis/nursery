import type { ReactNode } from "react";
import styles from "./empty-state.module.css";

type EmptyStateProps = {
  title: string;
  /** Объясняет, почему пусто. «Ничего не найдено» без причины не годится. */
  description: string;
  /** Действие обязательно: пустой экран без выхода — тупик. */
  action: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <h2>{title}</h2>
      <p className={styles.description}>{description}</p>
      <div className={styles.action}>{action}</div>
    </div>
  );
}
