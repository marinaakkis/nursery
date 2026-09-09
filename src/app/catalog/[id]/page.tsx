import { PlantScreen } from "./plant-screen";

export const metadata = { title: "Растение — Питомник растений" };

/** Идентификатор растения идёт сегментом пути: колонки slug в схеме нет. */
export default async function PlantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="page">
      <PlantScreen plantId={id} />
    </main>
  );
}
