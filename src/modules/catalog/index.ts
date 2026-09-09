import type { AppModule } from "@/modules/types";
import { routes } from "./routes";
import { tools } from "./tools";

export * from "./schema";
export * from "./service";

export const module_: AppModule = { name: "catalog", routes, tools };
