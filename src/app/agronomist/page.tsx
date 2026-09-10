import { AgronomistScreen } from "./agronomist-screen";

export const metadata = { title: "Очередь вопросов" };

export default async function AgronomistPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const initial = Number(q);

  return (
    // Служебная роль: плотнее, без serif в заголовках — это рабочее место,
    // а не витрина. Набор токенов тот же.
    <main className="page" data-ui="service">
      <h1>Очередь вопросов</h1>
      <AgronomistScreen initialQuestionId={Number.isInteger(initial) && initial > 0 ? initial : null} />
    </main>
  );
}
