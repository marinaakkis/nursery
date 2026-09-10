import Link from "next/link";
import { CalendarScreen } from "./calendar-screen";
import styles from "../garden.module.css";

export const metadata = { title: "Календарь ухода" };

export default function CalendarPage() {
  return (
    <main className="page">
      <h1>Календарь ухода</h1>
      <nav className={styles.tabs} aria-label="Разделы сада">
        <Link className={styles.tab} href="/garden">
          Растения
        </Link>
        <span className={`${styles.tab} ${styles.tabCurrent}`} aria-current="page">
          Календарь
        </span>
      </nav>
      <CalendarScreen />
    </main>
  );
}
