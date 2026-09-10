import { WarehouseNav } from "./nav";
import { StockScreen } from "./stock-screen";

export const metadata = { title: "Склад — остатки" };

export default function WarehousePage() {
  return (
    <main className="page" data-ui="service">
      <h1>Остатки</h1>
      <WarehouseNav current="/warehouse" />
      <StockScreen />
    </main>
  );
}
