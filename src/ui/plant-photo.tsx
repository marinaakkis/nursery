import type { ReactNode } from "react";
import styles from "./plant-photo.module.css";

type PlantPhotoProps = {
  /** Название растения: первая буква занимает место снимка. */
  name: string;
  variant?: "card" | "hero" | "thumb";
  dimmed?: boolean;
  /** Бейдж наличия поверх подложки. */
  overlay?: ReactNode;
};

export function PlantPhoto({ name, variant = "card", dimmed = false, overlay }: PlantPhotoProps) {
  const letter = name.trim().charAt(0).toUpperCase();

  return (
    <div
      className={[styles.photo, styles[variant]].join(" ")}
      // Буква — оформление, а не содержание: название стоит рядом текстом.
      aria-hidden={overlay ? undefined : true}
    >
      {/* Гасим букву, а не блок целиком: иначе прозрачность накрывает и бейдж. */}
      <span className={dimmed ? styles.dimmedLetter : undefined} aria-hidden="true">
        {letter}
      </span>
      {overlay ? <span className={styles.overlay}>{overlay}</span> : null}
    </div>
  );
}
