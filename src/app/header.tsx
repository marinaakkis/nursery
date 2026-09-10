import Link from "next/link";
import { BrandMark } from "@/ui";
import styles from "./header.module.css";
import { countDueCareEvents } from "@/modules/garden";
import { currentUser, listDemoUsers } from "@/lib/demo-user.server";
import { UserSwitcher } from "./user-switcher";

export async function Header() {
  // База может быть недоступна — на сборке образа её нет вовсе. Шапка не имеет
  // права уронить страницу из-за заглушки входа: без списка она просто пустая.
  const [users, user] = await Promise.all([
    listDemoUsers().catch(() => []),
    currentUser().catch(() => null),
  ]);

  // Напоминание — сколько дел по уходу уже пора сделать. Считается тем же
  // способом, что и на экране: события с датой не позже сегодняшней.
  const dueCare =
    user?.role === "customer" ? await countDueCareEvents(user.id).catch(() => 0) : 0;

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
          <Link className={styles.link} href="/garden">
            Мой сад
            {dueCare > 0 ? (
              <span className={styles.count} aria-label={`дел по уходу: ${dueCare}`}>
                {dueCare}
              </span>
            ) : null}
          </Link>
          <Link className={styles.link} href="/orders">
            Заказы
          </Link>
        </nav>
        <UserSwitcher users={users} current={user} />
      </div>
    </header>
  );
}
