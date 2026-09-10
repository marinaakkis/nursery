import { WarehouseNav } from "../nav";
import { PlanScreen } from "./plan-screen";

export const metadata = { title: "Склад — план закупок" };

export default function PlanPage() {
  return (
    <main className="page" data-ui="service">
      <h1>План закупок</h1>
      <WarehouseNav current="/warehouse/plan" />
      <PlanScreen />
    </main>
  );
}
