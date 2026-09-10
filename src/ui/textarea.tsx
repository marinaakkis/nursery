"use client";

import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";
import styles from "./textarea.module.css";

type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className">;

/** Многострочное поле. Растёт по содержимому, ручки ресайза нет. */
export function Textarea({ value, ...rest }: TextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Высота — свойство содержимого, а не состояние: считаем после отрисовки
  // и пишем прямо в стиль элемента, ничего не перерисовывая.
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.max(node.scrollHeight, 120)}px`;
  }, [value]);

  return <textarea {...rest} value={value} ref={ref} className={styles.textarea} />;
}
