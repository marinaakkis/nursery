import { QuestionsScreen } from "./questions-screen";

export const metadata = { title: "Вопросы агроному" };

export default function QuestionsPage() {
  return (
    <main className="page pageForm">
      <h1>Вопросы агроному</h1>
      <QuestionsScreen />
    </main>
  );
}
