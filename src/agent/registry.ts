import type { AppModule } from "@/modules/types";
import type { Tool, ToolAudience } from "@/agent/types";
import { module_ as catalog } from "@/modules/catalog";
import { module_ as consult } from "@/modules/consult";
import { module_ as garden } from "@/modules/garden";
import { module_ as orders } from "@/modules/orders";
import { module_ as warehouse } from "@/modules/warehouse";

/** Единственное место, где перечислены модули. Инструменты и роуты подхватываются сами. */
export const modules: AppModule[] = [catalog, orders, garden, consult, warehouse];

const moduleByName = new Map(modules.map((m) => [m.name, m]));

export function getModule(name: string): AppModule | undefined {
  return moduleByName.get(name);
}

function buildToolMap(): Map<string, Tool> {
  const map = new Map<string, Tool>();
  for (const m of modules) {
    for (const tool of m.tools) {
      // Совпадение имён — ошибка на старте, а не тихая перезапись.
      if (map.has(tool.name)) throw new Error(`Инструмент объявлен дважды: ${tool.name}`);
      map.set(tool.name, tool);
    }
  }
  return map;
}

export const toolsByName = buildToolMap();

export const allTools = (): Tool[] => [...toolsByName.values()];

/** В агентский цикл уходит не весь реестр, а срез по роли пользователя. */
export const forAudience = (audience: ToolAudience): Tool[] =>
  allTools().filter((t) => t.audience === audience);
