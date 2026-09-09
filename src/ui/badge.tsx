import type { ReactNode } from "react";
import styles from "./badge.module.css";

type BadgeProps = {
  tone?: "neutral" | "progress" | "success" | "warning" | "danger";
  /** Подпись обязательна: цвет смысла в одиночку не несёт. */
  children: ReactNode;
};

export function Badge({ tone = "neutral", children }: BadgeProps) {
  return <span className={[styles.badge, styles[tone]].join(" ")}>{children}</span>;
}
