"use client";

import { useId } from "react";
import styles from "./file-field.module.css";

type FileFieldProps = {
  id?: string;
  accept?: string;
  /** Подпись на кнопке. Действие, а не «Выберите файл». */
  label?: string;
  /** Имя выбранного файла — показываем рядом с кнопкой. */
  fileName?: string;
  /** Готовый data-URL для превью: видно, что именно приложено. */
  previewUrl?: string | null;
  onPick: (file: File | null) => void;
  onClear?: () => void;
};

export function FileField({
  id,
  accept = "image/jpeg,image/png,image/webp",
  label = "Прикрепить фото",
  fileName,
  previewUrl,
  onPick,
  onClear,
}: FileFieldProps) {
  const auto = useId();
  const inputId = id ?? auto;

  return (
    <span className={styles.wrap}>
      <span className={styles.row}>
        <input
          id={inputId}
          type="file"
          accept={accept}
          className={styles.input}
          onChange={(event) => onPick(event.target.files?.[0] ?? null)}
        />
        <label className={styles.button} htmlFor={inputId}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12.5 8 8 12.5a2.5 2.5 0 0 1-3.5-3.5l5-5a4 4 0 0 1 5.5 5.5l-5 5" />
          </svg>
          {label}
        </label>
      </span>

      {/* Превью и действие в одной строке: снимок и кнопка «убрать» относятся
          друг к другу, и разносить их по разным строкам незачем. */}
      {previewUrl || fileName ? (
        <span className={styles.picked}>
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data-URL из формы, файла на диске ещё нет
            <img className={styles.preview} src={previewUrl} alt="Предпросмотр приложенного снимка" />
          ) : null}
          {fileName ? <span className={styles.name}>{fileName}</span> : null}
          {onClear ? (
            <button
              type="button"
              className={styles.remove}
              onClick={onClear}
              aria-label="Убрать фото"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 5.5h14M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 5.5 6.3 16a1 1 0 0 0 1 .9h5.4a1 1 0 0 0 1-.9l.8-10.5M8.5 9v5M11.5 9v5" />
              </svg>
            </button>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
