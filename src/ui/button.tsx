"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./button.module.css";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "regular" | "large";
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
};

/** Кнопка. Подпись при загрузке не исчезает: пользователь должен видеть,
 *  какое действие сейчас выполняется, а не пустой прямоугольник. */
export function Button({
  variant = "primary",
  size = "regular",
  loading = false,
  fullWidth = false,
  disabled = false,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={[
        styles.button,
        styles[variant],
        size === "large" ? styles.large : "",
        fullWidth ? styles.fullWidth : "",
      ]
        .join(" ")
        .trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
