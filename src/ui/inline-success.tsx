import styles from "./inline-success.module.css";

/** Подтверждение стоит там, где действие: форма не исчезает молча. */
export function InlineSuccess({ message }: { message: string }) {
  return (
    <p className={styles.success} role="status" aria-live="polite">
      <svg
        className={styles.icon}
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m4 10.5 4 4 8-9" />
      </svg>
      {message}
    </p>
  );
}
