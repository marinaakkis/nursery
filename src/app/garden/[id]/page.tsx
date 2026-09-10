import { GardenPlantScreen } from "./garden-plant-screen";

export const metadata = { title: "Растение в саду" };

/** Идентификатор строки сада, а не растения: у покупателя своя запись. */
export default async function GardenPlantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="page">
      <GardenPlantScreen gardenPlantId={id} />
    </main>
  );
}
