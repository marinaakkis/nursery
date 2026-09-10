import Link from "next/link";
import styles from "./warehouse.module.css";

const TABS = [
  { href: "/warehouse", label: "Остатки" },
  { href: "/warehouse/batches", label: "Приход и списание" },
  { href: "/warehouse/orders", label: "Очередь сборки" },
  { href: "/warehouse/plan", label: "План закупок" },
];

export function WarehouseNav({ current }: { current: string }) {
  return (
    <nav className={styles.tabs} aria-label="Разделы склада">
      {TABS.map((tab) =>
        tab.href === current ? (
          <span className={`${styles.tab} ${styles.tabCurrent}`} key={tab.href} aria-current="page">
            {tab.label}
          </span>
        ) : (
          <Link className={styles.tab} key={tab.href} href={tab.href}>
            {tab.label}
          </Link>
        ),
      )}
    </nav>
  );
}
