import { providerLabel } from "@/agent/provider";
import { currentUser } from "@/lib/demo-user.server";
import { AssistantScreen } from "./assistant-screen";

export const metadata = { title: "AI-помощник" };

export default async function AssistantPage() {
  // Роль читается на сервере: предупреждение о невыбранном покупателе
  // должно быть видно сразу при входе, а не после первой попытки спросить.
  // .catch как у остальных страниц: при отказе базы срабатывает экран ошибки,
  // а не 500 всей страницы.
  const user = await currentUser().catch(() => null);
  const canAsk = user?.role === "customer";
  // Режим подбора читается на сервере из окружения — спека §4.3: «режим виден
  // в интерфейсе». Клиент про переменные окружения знать не должен.
  const mode = providerLabel();

  // Большого заголовка страницы здесь нет намеренно: чат занимает экран
  // целиком, и заголовок над ним съедал бы высоту ленты. Название стоит
  // мелко в шапке самого контейнера — как в любом мессенджере.
  return (
    <main className="page">
      <AssistantScreen canAsk={canAsk} mode={mode} />
    </main>
  );
}
