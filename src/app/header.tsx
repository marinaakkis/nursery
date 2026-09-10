import Link from "next/link";
import styles from "./header.module.css";
import { currentUser, listDemoUsers } from "@/lib/demo-user.server";
import { UserSwitcher } from "./user-switcher";

export async function Header() {
  const [users, user] = await Promise.all([listDemoUsers(), currentUser()]);

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link className={styles.brand} href="/catalog">
          Питомник
        </Link>
        <nav className={styles.nav}>
          <Link className={styles.link} href="/assistant">
            Агент
          </Link>
          <Link className={styles.link} href="/cart">
            Корзина
          </Link>
          <Link className={styles.link} href="/orders">
            Заказы
          </Link>
        </nav>
        <UserSwitcher users={users} currentId={user?.id ?? null} />
      </div>
      <p className={styles.stub}>Вход — заглушка: пользователь выбирается вручную, пароля нет</p>
    </header>
  );
}
