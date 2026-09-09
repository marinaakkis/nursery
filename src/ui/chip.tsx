"use client";

import type { ReactNode } from "react";
import styles from "./chip.module.css";

type ToggleChipProps = {
  children: ReactNode;
  pressed: boolean;
  onToggle: () => void;
  removable?: false;
};

type RemovableChipProps = {
  children: ReactNode;
  removable: true;
  onRemove: () => void;
  /** Что именно снимется: попадает в aria-label крестика. */
  removeLabel: string;
};

type ChipProps = ToggleChipProps | RemovableChipProps;

/** Чип фильтра. Две роли: переключатель в панели фильтров и снимаемый
 *  применённый фильтр в строке над выдачей. Третьей не бывает. */
export function Chip(props: ChipProps) {
  if (props.removable) {
    return (
      <button
        type="button"
        className={[styles.chip, styles.removable].join(" ")}
        onClick={props.onRemove}
        aria-label={`Убрать фильтр: ${props.removeLabel}`}
      >
        {props.children}
        <svg
          className={styles.cross}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="m4 4 8 8M12 4l-8 8" />
        </svg>
      </button>
    );
  }

  return (
    <button type="button" className={styles.chip} aria-pressed={props.pressed} onClick={props.onToggle}>
      {props.children}
    </button>
  );
}
