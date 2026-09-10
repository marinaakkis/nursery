"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Sheet } from "@/ui";
import { DEMO_USER_COOKIE, ROLE_LABEL, type DemoUser } from "@/lib/demo-user";
import styles from "./header.module.css";

/** Запись cookie живёт вне компонента: правило React Compiler запрещает
 *  менять внешнее состояние из тела компонента. Вызывается только из обработчика. */
function rememberUser(id: number): void {
  document.cookie = `${DEMO_USER_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
}

/** Переключатель демо-пользователя: кружок в шапке, выбор — в шите.
 *  Ставит ту же cookie, которую читает диспетчер API. Пароля нет и не будет. */
export function UserSwitcher({ users, current }: { users: DemoUser[]; current: DemoUser | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  function choose(user: DemoUser) {
    rememberUser(user.id);
    setOpen(false);
    startTransition(() => router.refresh());
  }

  return (
    <>
      <button
        type="button"
        className={[styles.avatar, current ? "" : styles.avatarEmpty].join(" ").trim()}
        onClick={() => setOpen(true)}
        aria-label={
          current
            ? `Сейчас вы ${current.name}, ${ROLE_LABEL[current.role]}. Сменить пользователя`
            : "Выбрать пользователя"
        }
      >
        {current ? current.name.charAt(0) : "?"}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Кто вы сегодня">
        <p className={styles.sheetNote}>
          Вход — заглушка: пароля нет, роль следует из выбранного человека.
        </p>
        <div className={styles.users}>
          {users.map((user) => (
            <button
              type="button"
              key={user.id}
              className={[styles.user, current?.id === user.id ? styles.userCurrent : ""]
                .join(" ")
                .trim()}
              onClick={() => choose(user)}
              aria-current={current?.id === user.id ? "true" : undefined}
            >
              <span className={styles.userName}>
                <span>{user.name}</span>
                <span className={styles.userRole}>{ROLE_LABEL[user.role]}</span>
              </span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
