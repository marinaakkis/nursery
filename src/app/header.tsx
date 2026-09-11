import Link from "next/link";
import { BrandMark, SparkMark } from "@/ui";
import styles from "./header.module.css";
import { countDueCareEvents } from "@/modules/garden";
import { countCartItems, currentUser, listDemoUsers } from "@/lib/demo-user.server";
import type { DemoUser } from "@/lib/demo-user";
import { UserSwitcher } from "./user-switcher";

export async function Header() {
  /*
   * 🔶 База может быть недоступна — на сборке образа её нет вовсе, и шапка
   * не имеет права уронить страницу. Но и прятать отказ за пустым списком
   * нельзя: 11.09 страницы выглядели живыми при снесённой схеме именно
   * потому, что шапка молча превращала ошибку в «пусто». Ошибка остаётся
   * ошибкой: пишется в лог уровнем error и показывается полосой под шапкой.
   * Разбор — memory/mistakes/2026-09-11-shema-snesena-kontejner-ne-perezapushchen.md
   */
  const [usersResult, userResult] = await Promise.allSettled([listDemoUsers(), currentUser()]);
  const dbFailed = usersResult.status === "rejected" || userResult.status === "rejected";
  if (dbFailed) {
    console.error(
      "header: база не ответила — страница отрисована без данных",
      usersResult.status === "rejected" ? usersResult.reason : userResult.status === "rejected" ? userResult.reason : null,
    );
  }
  const users: DemoUser[] = usersResult.status === "fulfilled" ? usersResult.value : [];
  const user: DemoUser | null = userResult.status === "fulfilled" ? userResult.value : null;

  // Напоминание — сколько дел по уходу уже пора сделать. Считается тем же
  // способом, что и на экране: события с датой не позже сегодняшней.
  const dueCare =
    user?.role === "customer" ? await countDueCareEvents(user.id).catch(() => 0) : 0;

  // Иконка корзины появляется, только когда в ней что-то есть: пустая корзина
  // в шапке — это напоминание ни о чём.
  const inCart =
    user?.role === "customer" ? await countCartItems(user.id).catch(() => 0) : 0;

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link className={styles.brand} href="/">
          <BrandMark size={22} />
          Северный сад
        </Link>
        {/* Разделы зависят от роли: у склада и агронома своё рабочее место,
            и витринные пункты им только мешают. */}
        <nav className={styles.nav} aria-label="Разделы">
          {user?.role === "agronomist" ? (
            <>
              <Link className={styles.link} href="/agronomist">
                Очередь вопросов
              </Link>
              <Link className={styles.link} href="/catalog">
                Каталог
              </Link>
            </>
          ) : user?.role === "warehouse" ? (
            <>
              <Link className={styles.link} href="/warehouse">
                Остатки
              </Link>
              <Link className={styles.link} href="/warehouse/orders">
                Сборка
              </Link>
              <Link className={styles.link} href="/warehouse/plan">
                Закупки
              </Link>
            </>
          ) : (
            <>
              {/* Первым пунктом и выделенный: это то, ради чего продукт
                  отличается от обычного каталога, и заметить его надо
                  раньше, чем каталог. */}
              <Link className={`${styles.link} ${styles.ai}`} href="/assistant">
                <SparkMark size={14} />
                <span className={styles.aiText}>AI-помощник</span>
              </Link>
              <Link className={styles.link} href="/catalog">
                Каталог
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
            </>
          )}
        </nav>
        {inCart > 0 ? (
          <Link className={styles.cart} href="/cart" aria-label={`Корзина, позиций: ${inCart}`}>
            <svg
              width="22"
              height="22"
              viewBox="0 0 22 22"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 3h2.2l2.1 10.4a1.8 1.8 0 0 0 1.8 1.4h7.9a1.8 1.8 0 0 0 1.7-1.3L20 6.5H5.2" />
              <circle cx="9" cy="19" r="1.3" />
              <circle cx="17" cy="19" r="1.3" />
            </svg>
            <span className={styles.cartCount}>{inCart}</span>
          </Link>
        ) : null}

        <UserSwitcher users={users} current={user} />
      </div>
      {dbFailed ? (
        <p className={styles.dbWarning} role="alert">
          База данных не отвечает — страницы показываются без данных. Проверьте{" "}
          <code>/health</code> и лог контейнера.
        </p>
      ) : null}
    </header>
  );
}
