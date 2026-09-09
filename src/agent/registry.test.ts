import { describe, expect, it } from "vitest";
import { allTools, modules, toolsByName } from "./registry";

describe("реестр инструментов", () => {
  it("собирает ровно столько инструментов, сколько объявили модули", () => {
    const declared = modules.reduce((sum, m) => sum + m.tools.length, 0);
    expect(allTools()).toHaveLength(declared);
  });

  it("не теряет инструменты при совпадении имён — карта и список одной длины", () => {
    expect(toolsByName.size).toBe(allTools().length);
  });

  it("каждый инструмент назван с префиксом своего модуля", () => {
    for (const m of modules) {
      for (const tool of m.tools) {
        expect(tool.name.startsWith(`${m.name}.`)).toBe(true);
      }
    }
  });
});
