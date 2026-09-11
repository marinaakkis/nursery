import { redirect } from "next/navigation";
import { currentUser } from "@/lib/demo-user.server";
import { ThreadScreen } from "./thread-screen";

export const metadata = { title: "Переписка с агрономом" };

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // .catch как у остальных страниц: при отказе базы срабатывает экран ошибки,
  // а не 500 всей страницы.
  const user = await currentUser().catch(() => null);

  // Агроному этот маршрут показывал покупательский экран: форму «Дополнить вопрос»
  // с подсказкой «агроном увидит сообщение» — экран говорил роли неправду о ней
  // самой, и рабочего инструмента (черновик → отправка) на нём не было.
  // Второй копии черновика заводить не стали: у агронома есть своё место.
  if (user?.role === "agronomist") redirect(`/agronomist?q=${id}`);

  return (
    <main className="page">
      <ThreadScreen questionId={id} />
    </main>
  );
}
