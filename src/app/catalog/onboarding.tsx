import { cookies } from "next/headers";
import { ONBOARDING_COOKIE } from "./onboarding-cookie";
import { OnboardingDismiss } from "./onboarding-dismiss";
import styles from "./onboarding.module.css";

/**
 * Подсказка на три шага при первом открытии каталога — spec §7.
 * Не модалка: не перекрывает выдачу, не ловит фокус и не требует закрытия
 * перед работой. Признак «уже видел» читается на сервере, поэтому подсказка
 * не мигает на секунду у того, кто её давно закрыл.
 */
export async function Onboarding() {
  const seen = (await cookies()).get(ONBOARDING_COOKIE)?.value === "1";
  if (seen) return null;

  return (
    <section className={styles.card} aria-labelledby="onboarding-title">
      <h2 className={styles.title} id="onboarding-title">
        Как здесь всё устроено
      </h2>
      <ol className={styles.steps}>
        <li>Подберите растения фильтрами — свет, зона, сезон посадки, уход.</li>
        <li>Или опишите участок помощнику, он соберёт подборку сам.</li>
        <li>После покупки растения попадут в «Мой сад» с календарём ухода.</li>
      </ol>
      <OnboardingDismiss />
    </section>
  );
}
