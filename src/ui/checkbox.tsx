"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import styles from "./checkbox.module.css";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type"> & {
  children: ReactNode;
};

export function Checkbox({ children, ...rest }: CheckboxProps) {
  return (
    <label className={styles.label}>
      <input {...rest} type="checkbox" className={styles.input} />
      <span className={styles.box} aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m2 7.5 3 3 7-7" />
        </svg>
      </span>
      <span className={styles.text}>{children}</span>
    </label>
  );
}
