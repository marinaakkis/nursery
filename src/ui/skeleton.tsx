import styles from "./skeleton.module.css";

type SkeletonProps = {
  /** Форма будущего контента, а не спиннер по центру. */
  variant?: "text" | "block" | "card";
  count?: number;
  /** Что грузится — уходит в озвучку скринридеру вместо пустоты. */
  label?: string;
};

export function Skeleton({ variant = "text", count = 3, label = "Загружаем данные" }: SkeletonProps) {
  const shapes = Array.from({ length: count }, (_, index) => index);

  return (
    <div className={variant === "card" ? styles.grid : styles.list} role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      {shapes.map((index) => (
        <div key={index} className={[styles.shape, styles[variant]].join(" ")} aria-hidden="true" />
      ))}
    </div>
  );
}
