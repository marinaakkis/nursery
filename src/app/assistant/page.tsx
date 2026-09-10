import { AssistantScreen } from "./assistant-screen";

export const metadata = { title: "Агент подбора — Питомник растений" };

export default function AssistantPage() {
  return (
    <main className="page">
      <h1>Агент подбора</h1>
      <AssistantScreen />
    </main>
  );
}
