import type { ReactNode } from "react";
import styles from "./error-state.module.css";

type ErrorStateProps = {
  /** Называет причину и выход. «Что-то пошло не так» — не сообщение. */
  message: string;
  /** Кнопка повтора: Button живёт в клиентском компоненте, поэтому приходит слотом. */
  action?: ReactNode;
};

export function ErrorState({ message, action }: ErrorStateProps) {
  return (
    <div className={styles.error} role="alert">
      <p className={styles.message}>{message}</p>
      {action}
    </div>
  );
}
