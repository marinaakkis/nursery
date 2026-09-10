import Link from "next/link";
import { BrandMark } from "@/ui";
import styles from "./header.module.css";
import { currentUser, listDemoUsers } from "@/lib/demo-user.server";
import { UserSwitcher } from "./user-switcher";

export async function Header() {
  const [users, user] = await Promise.all([listDemoUsers(), currentUser()]);

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link className={styles.brand} href="/catalog">
          <BrandMark size={22} />
          Питомник
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
