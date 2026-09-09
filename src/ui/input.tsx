"use client";

import type { InputHTMLAttributes } from "react";
import styles from "./input.module.css";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className">;

/** Контрол ввода. Собственной подписи и ошибки не имеет — их даёт Field. */
export function Input({ type = "text", ...rest }: InputProps) {
  return <input {...rest} type={type} className={styles.input} />;
}
