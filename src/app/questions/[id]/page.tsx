import { ThreadScreen } from "./thread-screen";

export const metadata = { title: "Переписка с агрономом" };

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="page">
      <ThreadScreen questionId={id} />
    </main>
  );
}
