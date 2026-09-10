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
        {fileName ? <span className={styles.name}>{fileName}</span> : null}
        {fileName && onClear ? (
          <button type="button" className={styles.button} onClick={onClear}>
            Убрать
          </button>
        ) : null}
      </span>
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- data-URL из формы, файла на диске ещё нет
        <img className={styles.preview} src={previewUrl} alt="Предпросмотр приложенного снимка" />
      ) : null}
    </span>
  );
}
