import Link from "next/link";
import { BrandMark } from "@/ui";
import styles from "./header.module.css";
import { currentUser, listDemoUsers } from "@/lib/demo-user.server";
import { UserSwitcher } from "./user-switcher";

export async function Header() {
  // База может быть недоступна — на сборке образа её нет вовсе. Шапка не имеет
  // права уронить страницу из-за заглушки входа: без списка она просто пустая.
  const [users, user] = await Promise.all([
    listDemoUsers().catch(() => []),
    currentUser().catch(() => null),
  ]);

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link className={styles.brand} href="/catalog">
          <BrandMark size={22} />
          Северный сад
        </Link>
        <nav className={styles.nav} aria-label="Разделы">
          <Link className={styles.link} href="/catalog">
            Каталог
          </Link>
          <Link className={styles.link} href="/assistant">
            Помощник
          </Link>
          {/* 🔶 Раздел объявлен, но модуль garden пуст — вести в 404 хуже, чем сказать правду. */}
          <span className={styles.soon} title="Раздел ещё не собран">
            Мой сад · скоро
          </span>
          <Link className={styles.link} href="/orders">
            Заказы
          </Link>
        </nav>
        <UserSwitcher users={users} current={user} />
      </div>
    </header>
  );
}
