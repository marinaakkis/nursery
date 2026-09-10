import { currentUser } from "@/lib/demo-user.server";
import { AssistantScreen } from "./assistant-screen";

export const metadata = { title: "Помощник по подбору" };

export default async function AssistantPage() {
  // Роль читается на сервере: предупреждение о невыбранном покупателе
  // должно быть видно сразу при входе, а не после первой попытки спросить.
  const user = await currentUser();
  const canAsk = user?.role === "customer";

  return (
    <main className="page">
      <h1>Агент подбора</h1>
      <AssistantScreen canAsk={canAsk} />
    </main>
  );
}
