import Link from "next/link";
import { GardenScreen } from "./garden-screen";
import styles from "./garden.module.css";

export const metadata = { title: "Мой сад" };

export default function GardenPage() {
  return (
    <main className="page">
      <h1>Мой сад</h1>
      <nav className={styles.tabs} aria-label="Разделы сада">
        <span className={`${styles.tab} ${styles.tabCurrent}`} aria-current="page">
          Растения
        </span>
        <Link className={styles.tab} href="/garden/calendar">
          Календарь
        </Link>
      </nav>
      <GardenScreen />
    </main>
  );
}
