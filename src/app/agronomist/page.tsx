import { AgronomistScreen } from "./agronomist-screen";

export const metadata = { title: "Очередь вопросов" };

export default function AgronomistPage() {
  return (
    // Служебная роль: плотнее, без serif в заголовках — это рабочее место,
    // а не витрина. Набор токенов тот же.
    <main className="page" data-ui="service">
      <h1>Очередь вопросов</h1>
      <AgronomistScreen />
    </main>
  );
}
