import Image from "next/image";
import type { ReactNode } from "react";
import styles from "./plant-photo.module.css";

type PlantPhotoProps = {
  /** Путь к снимку. Приходит из базы (photo_url), а не считается по номеру строки. */
  photoUrl?: string | null;
  /** Название: подпись для скринридера и буква в заглушке, если снимка нет. */
  name: string;
  variant?: "card" | "hero" | "thumb";
  dimmed?: boolean;
  /** Бейдж наличия поверх снимка. */
  overlay?: ReactNode;
  /** Крупный снимок на экране растения грузим сразу, остальные — лениво. */
  priority?: boolean;
};

const SIZES: Record<string, string> = {
  card: "(max-width: 700px) 50vw, 25vw",
  hero: "(max-width: 960px) 100vw, 960px",
  thumb: "56px",
};

export function PlantPhoto({
  photoUrl,
  name,
  variant = "card",
  dimmed = false,
  overlay,
  priority = false,
}: PlantPhotoProps) {
  const src = photoUrl ?? null;
  const letter = name.trim().charAt(0).toUpperCase();

  return (
    <div className={[styles.photo, styles[variant]].join(" ")}>
      {src ? (
        <Image
          className={dimmed ? styles.dimmedPhoto : undefined}
          src={src}
          alt={name}
          fill
          sizes={SIZES[variant]}
          priority={priority}
        />
      ) : (
        // Снимка нет — подложка с названием на шрифте заголовков, не серый квадрат.
        <span className={dimmed ? styles.dimmedLetter : undefined} aria-hidden="true">
          {letter}
        </span>
      )}
      {overlay ? <span className={styles.overlay}>{overlay}</span> : null}
    </div>
  );
}
