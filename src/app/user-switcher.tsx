"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import styles from "./header.module.css";
import { DEMO_USER_COOKIE, ROLE_LABEL, type DemoUser } from "@/lib/demo-user";

/** Переключатель демо-пользователя. Ставит cookie и перечитывает страницу —
 *  ровно ту же cookie читает диспетчер API. Пароля нет и не будет: это заглушка. */
export function UserSwitcher({ users, currentId }: { users: DemoUser[]; currentId: number | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <span className={styles.switcher}>
      <label htmlFor="demo-user" className="sr-only">
        Демо-пользователь
      </label>
      <select
        id="demo-user"
        className={styles.select}
        value={currentId ?? ""}
        disabled={pending}
        onChange={(event) => {
          const value = event.target.value;
          document.cookie = `${DEMO_USER_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
          startTransition(() => router.refresh());
        }}
      >
        <option value="" disabled>
          Выберите пользователя
        </option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} · {ROLE_LABEL[user.role]}
          </option>
        ))}
      </select>
    </span>
  );
}
