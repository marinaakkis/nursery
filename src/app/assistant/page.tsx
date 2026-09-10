import { AssistantScreen } from "./assistant-screen";

export const metadata = { title: "Помощник по подбору" };

export default function AssistantPage() {
  return (
    <main className="page pageForm">
      <h1>Агент подбора</h1>
      <AssistantScreen />
    </main>
  );
}
