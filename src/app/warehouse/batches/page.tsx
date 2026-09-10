import { WarehouseNav } from "../nav";
import { BatchesScreen } from "./batches-screen";

export const metadata = { title: "Склад — приход и списание" };

export default function BatchesPage() {
  return (
    <main className="page" data-ui="service">
      <h1>Приход и списание</h1>
      <WarehouseNav current="/warehouse/batches" />
      <BatchesScreen />
    </main>
  );
}
