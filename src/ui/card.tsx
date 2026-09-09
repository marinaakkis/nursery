import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./card.module.css";

type CardProps = {
  /** Ссылка делает кликабельной всю карточку целиком, а не отдельную подпись. */
  href?: string;
  dimmed?: boolean;
  children: ReactNode;
};

export function Card({ href, dimmed = false, children }: CardProps) {
  const className = [styles.card, dimmed ? styles.dimmed : "", href ? styles.link : ""].join(" ").trim();

  if (href) {
    return (
      <Link className={className} href={href}>
        {children}
      </Link>
    );
  }

  return <article className={className}>{children}</article>;
}

/** Место под изображение. Загрузка фото в демо не подключена — подпись честная. */
export function CardPhoto({ children = "фото" }: { children?: ReactNode }) {
  return <div className={styles.photo}>{children}</div>;
}

export function CardBody({ children }: { children: ReactNode }) {
  return <div className={styles.body}>{children}</div>;
}
