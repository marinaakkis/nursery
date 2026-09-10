import Link from "next/link";
import { BrandMark } from "@/ui";
import styles from "./footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div>
          <span className={styles.brand}>
            <BrandMark size={20} />
            Северный сад
          </span>
          <p className={styles.about}>
            Саженцы и рассада для зоны 3–4. Всё, что мы продаём, зимует в Ленинградской
            области без танцев с укрывным материалом.
          </p>
        </div>

        <div>
          <p className={styles.title}>Самовывоз</p>
          <ul className={styles.list}>
            <li className={styles.line}>Ленинградская область, Всеволожский район,</li>
            <li className={styles.line}>деревня Юкки, Питомническая улица, 4</li>
            <li className={styles.line}>Ежедневно 9:00–19:00</li>
            <li>
              <a href="tel:+78120000000">+7 812 000-00-00</a>
            </li>
          </ul>
        </div>

        <div>
          <p className={styles.title}>Разделы</p>
          <ul className={styles.list}>
            <li>
              <Link href="/catalog">Каталог</Link>
            </li>
            <li>
              <Link href="/assistant">Помощник по подбору</Link>
            </li>
            <li>
              <Link href="/orders">Мои заказы</Link>
            </li>
          </ul>
        </div>
      </div>

      <p className={styles.stub}>
        Адрес и телефон — демонстрационные. Оплата, доставка и уведомления работают
        заглушками: деньги не списываются, курьер не выезжает.
      </p>
    </footer>
  );
}
