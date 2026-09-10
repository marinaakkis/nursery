"use client";

import type { ReactNode, SelectHTMLAttributes } from "react";
import styles from "./select.module.css";

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> & {
  children: ReactNode;
};

/** Выпадающий список на токенах. Нативный select внутри — клавиатура,
 *  скринридер и мобильное колесо достаются даром. */
export function Select({ children, ...rest }: SelectProps) {
  return (
    <span className={styles.wrap}>
      <select {...rest} className={styles.select}>
        {children}
      </select>
      <svg
        className={styles.arrow}
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m4 6 4 4 4-4" />
      </svg>
    </span>
  );
}
