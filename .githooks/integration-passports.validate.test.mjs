#!/usr/bin/env node
// Run: node --test .githooks/integration-passports.validate.test.mjs

import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  parseIntegrationLog,
  validateLogRows,
  renderIntegrationLog,
  matchesDetector,
  isCodeFile,
  resolvePassportPath,
  createNewLogRow,
  normalizePath,
  detectProjectStacks,
  INTEGRATION_DETECTORS,
  REQUIRED_PASSPORT_FIELDS,
  validatePassport,
  computeLogPathForModule,
  extractRequiredFieldValue,
} from "./integration-passports.validate.mjs";

// ─── helpers ─────────────────────────────────────────────────────────────────

const TS = "2024-06-01T12:00:00Z";
const TS2 = "2024-06-02T12:00:00Z";
const LOG_PATH = "docs/integrations/integrations-log.app.md";

function baseRow(overrides = {}) {
  return {
    integrationId: "kafka-integration",
    name: "Kafka integration",
    stack: "Kafka",
    scope: "external",
    addedAtUtc: TS,
    lastChangedAtUtc: TS2,
    deletedAtUtc: "",
    codeMarker: "Kafka integration",
    passportPath: "integration-passport.kafka-integration.md",
    logPathRelative: LOG_PATH,
    ...overrides,
  };
}

function makePassport(overrides = {}) {
  const fields = {
    "Название интеграции": "My Service",
    "Внешняя система": "ExternalSys",
    "Владелец (бизнес)": "TeamA",
    "Дата создания": "2024-01-01",
    "Tier проекта": "1",
    "Статус": "Active",
    "Направление": "Outbound",
    "Протокол": "HTTP",
    "Формат данных": "JSON",
    "Способ вызова": "Sync",
    "Метод аутентификации": "API Key",
    "Где хранятся credentials": "Vault",
    "Содержит персональные данные": "No",
    ...overrides,
  };

  const rows = Object.entries(fields)
    .map(([k, v]) => `| **${k}** [ОБЯЗАТЕЛЬНО] | ${v} |`)
    .join("\n");

  return `# Integration Passport\n\n${rows}\n\n## Changelog\n\n| 2024-01-01 | Author | Initial creation |\n`;
}

// ─── parseIntegrationLog ─────────────────────────────────────────────────────

describe("parseIntegrationLog", () => {
  test("parses 9-column current format", () => {
    const content = [
      "| Integration ID | Name | Stack | Scope | Added At UTC | Last Changed At UTC | Deleted At UTC | Code Marker | Passport Path |",
      "|---|---|---|---|---|---|---|---|---|",
      `| kafka-integration | Kafka integration | Kafka | external | ${TS} | ${TS2} | | Kafka integration | integration-passport.kafka-integration.md |`,
    ].join("\n");

    const rows = parseIntegrationLog(LOG_PATH, content);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].integrationId, "kafka-integration");
    assert.equal(rows[0].name, "Kafka integration");
    assert.equal(rows[0].stack, "Kafka");
    assert.equal(rows[0].scope, "external");
    assert.equal(rows[0].addedAtUtc, TS);
    assert.equal(rows[0].lastChangedAtUtc, TS2);
    assert.equal(rows[0].deletedAtUtc, "");
    assert.equal(rows[0].codeMarker, "Kafka integration");
    assert.equal(rows[0].passportPath, "integration-passport.kafka-integration.md");
    assert.equal(rows[0].logPathRelative, LOG_PATH);
  });

  test("parses 7-column legacy format — stack and scope are empty", () => {
    const content = [
      "| Integration ID | Name | Added At UTC | Last Changed At UTC | Deleted At UTC | Code Marker | Passport Path |",
      "|---|---|---|---|---|---|---|",
      `| kafka-integration | Kafka integration | ${TS} | ${TS2} | | Kafka integration | integration-passport.kafka-integration.md |`,
    ].join("\n");

    const rows = parseIntegrationLog(LOG_PATH, content);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].stack, "");
    assert.equal(rows[0].scope, "");
    assert.equal(rows[0].addedAtUtc, TS);
    assert.equal(rows[0].lastChangedAtUtc, TS2);
  });

  test("parses 6-column legacy format (no Name, Stack, Scope)", () => {
    const content = [
      "| Integration ID | Added At UTC | Last Changed At UTC | Deleted At UTC | Code Marker | Passport Path |",
      "|---|---|---|---|---|---|",
      `| kafka-integration | ${TS} | ${TS2} | | Kafka integration | integration-passport.kafka-integration.md |`,
    ].join("\n");

    const rows = parseIntegrationLog(LOG_PATH, content);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].integrationId, "kafka-integration");
    assert.equal(rows[0].name, "");
    assert.equal(rows[0].stack, "");
    assert.equal(rows[0].scope, "");
    assert.equal(rows[0].addedAtUtc, TS);
    assert.equal(rows[0].lastChangedAtUtc, TS2);
  });

  test("parses deleted row (non-empty Deleted At UTC)", () => {
    const content = `| kafka-integration | Kafka integration | ${TS} | ${TS2} | ${TS2} | Kafka (src/Consumer.cs) | integration-passport.kafka-integration.md |`;
    const rows = parseIntegrationLog(LOG_PATH, content);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].deletedAtUtc, TS2);
  });

  test("skips header row", () => {
    const content = "| Integration ID | Name | Added At UTC | Last Changed At UTC | Deleted At UTC | Code Marker | Passport Path |";
    const rows = parseIntegrationLog(LOG_PATH, content);
    assert.equal(rows.length, 0);
  });

  test("skips separator row", () => {
    const content = "|---|---|---|---|---|---|---|";
    const rows = parseIntegrationLog(LOG_PATH, content);
    assert.equal(rows.length, 0);
  });

  test("skips non-table lines", () => {
    const content = "# Integration Log\n\nSome description\n\nAnother line";
    const rows = parseIntegrationLog(LOG_PATH, content);
    assert.equal(rows.length, 0);
  });

  test("skips rows with fewer than 6 cells", () => {
    const content = "| id | added | last |";
    const rows = parseIntegrationLog(LOG_PATH, content);
    assert.equal(rows.length, 0);
  });

  test("strips backtick wrapping from cells", () => {
    const content = `| \`kafka-integration\` | \`Kafka\` | ${TS} | ${TS2} | | marker | integration-passport.kafka-integration.md |`;
    const rows = parseIntegrationLog(LOG_PATH, content);
    assert.equal(rows[0].integrationId, "kafka-integration");
    assert.equal(rows[0].name, "Kafka");
  });

  test("parses multiple rows", () => {
    const content = [
      `| svc-a | Name A | ${TS} | ${TS2} | | marker-a | integration-passport.svc-a.md |`,
      `| svc-b | Name B | ${TS} | ${TS2} | | marker-b | integration-passport.svc-b.md |`,
    ].join("\n");
    const rows = parseIntegrationLog(LOG_PATH, content);
    assert.equal(rows.length, 2);
  });
});

// ─── validateLogRows ─────────────────────────────────────────────────────────

describe("validateLogRows", () => {
  test("returns no errors for a valid active row", () => {
    const errors = validateLogRows([baseRow()], LOG_PATH);
    assert.deepEqual(errors, []);
  });

  test("returns no errors for a valid deleted row", () => {
    const errors = validateLogRows([baseRow({ deletedAtUtc: TS2 })], LOG_PATH);
    assert.deepEqual(errors, []);
  });

  test("errors on integration ID not in kebab-case", () => {
    const errors = validateLogRows([baseRow({ integrationId: "Kafka_Integration" })], LOG_PATH);
    assert.ok(errors.some((e) => e.includes("kebab-case")));
  });

  test("errors on duplicate integration ID", () => {
    const errors = validateLogRows([baseRow(), baseRow()], LOG_PATH);
    assert.ok(errors.some((e) => e.includes("дублирующийся")));
  });

  test("errors on invalid addedAtUtc format", () => {
    const errors = validateLogRows([baseRow({ addedAtUtc: "2024-01-01" })], LOG_PATH);
    assert.ok(errors.some((e) => e.includes("Added At UTC")));
  });

  test("errors on invalid lastChangedAtUtc format", () => {
    const errors = validateLogRows([baseRow({ lastChangedAtUtc: "not-a-date" })], LOG_PATH);
    assert.ok(errors.some((e) => e.includes("Last Changed At UTC")));
  });

  test("errors on non-empty deletedAtUtc with wrong format", () => {
    const errors = validateLogRows([baseRow({ deletedAtUtc: "2024-01-01" })], LOG_PATH);
    assert.ok(errors.some((e) => e.includes("Deleted At UTC")));
  });

  test("accepts empty deletedAtUtc", () => {
    const errors = validateLogRows([baseRow({ deletedAtUtc: "" })], LOG_PATH);
    assert.ok(!errors.some((e) => e.includes("Deleted At UTC")));
  });

  test("errors on empty codeMarker", () => {
    const errors = validateLogRows([baseRow({ codeMarker: "" })], LOG_PATH);
    assert.ok(errors.some((e) => e.includes("Code Marker")));
  });

  test("errors on TBD codeMarker", () => {
    const errors = validateLogRows([baseRow({ codeMarker: "TBD" })], LOG_PATH);
    assert.ok(errors.some((e) => e.includes("Code Marker")));
  });

  test("errors on TODO codeMarker", () => {
    const errors = validateLogRows([baseRow({ codeMarker: "TODO" })], LOG_PATH);
    assert.ok(errors.some((e) => e.includes("Code Marker")));
  });

  test("errors on empty passportPath", () => {
    const errors = validateLogRows([baseRow({ passportPath: "" })], LOG_PATH);
    assert.ok(errors.some((e) => e.includes("Passport Path")));
  });

  test("errors on passportPath not matching naming pattern", () => {
    const errors = validateLogRows([baseRow({ passportPath: "passport.md" })], LOG_PATH);
    assert.ok(errors.some((e) => e.includes("integration-passport.{integration-name}.md")));
  });

  test("accepts valid passportPath pattern", () => {
    const errors = validateLogRows([baseRow({ passportPath: "integration-passport.my-svc.md" })], LOG_PATH);
    assert.ok(!errors.some((e) => e.includes("integration-passport.{integration-name}.md")));
  });

  // Scope validation
  test("errors when active row has empty scope", () => {
    const errors = validateLogRows([baseRow({ scope: "" })], LOG_PATH);
    assert.ok(errors.some((e) => e.includes("Scope")));
  });

  test("errors when active row has invalid scope value", () => {
    const errors = validateLogRows([baseRow({ scope: "unknown" })], LOG_PATH);
    assert.ok(errors.some((e) => e.includes("Scope")));
  });

  test("no scope error for active row with scope=external", () => {
    const errors = validateLogRows([baseRow({ scope: "external" })], LOG_PATH);
    assert.ok(!errors.some((e) => e.includes("Scope")));
  });

  test("no scope error for active row with scope=internal", () => {
    const errors = validateLogRows([baseRow({ scope: "internal", passportPath: "-" })], LOG_PATH);
    assert.ok(!errors.some((e) => e.includes("Scope")));
  });

  test("no passport error for internal active row with passportPath=-", () => {
    const errors = validateLogRows([baseRow({ scope: "internal", passportPath: "-" })], LOG_PATH);
    assert.ok(!errors.some((e) => e.includes("Passport Path")));
  });

  test("no scope error for deleted row (scope check only for active)", () => {
    const errors = validateLogRows([baseRow({ scope: "", deletedAtUtc: TS2 })], LOG_PATH);
    assert.ok(!errors.some((e) => e.includes("Scope")));
  });
});

// ─── renderIntegrationLog ────────────────────────────────────────────────────

describe("renderIntegrationLog", () => {
  test("renders header with 9 columns (Stack + Scope added)", () => {
    const output = renderIntegrationLog([]);
    assert.ok(output.includes("| Integration ID | Name | Stack | Scope | Added At UTC | Last Changed At UTC | Deleted At UTC | Code Marker | Passport Path |"));
  });

  test("renders separator row with 9 pipes", () => {
    const output = renderIntegrationLog([]);
    assert.ok(output.includes("|---|---|---|---|---|---|---|---|---|"));
  });

  test("renders a single row with all fields", () => {
    const row = baseRow();
    const output = renderIntegrationLog([row]);
    assert.ok(output.includes("kafka-integration"));
    assert.ok(output.includes("Kafka integration"));
    assert.ok(output.includes(TS));
    assert.ok(output.includes(TS2));
    assert.ok(output.includes("integration-passport.kafka-integration.md"));
  });

  test("sorts rows alphabetically by integrationId", () => {
    const rows = [baseRow({ integrationId: "z-svc" }), baseRow({ integrationId: "a-svc" })];
    const output = renderIntegrationLog(rows);
    const idxA = output.indexOf("a-svc");
    const idxZ = output.indexOf("z-svc");
    assert.ok(idxA < idxZ, "a-svc must appear before z-svc");
  });

  test("escapes pipe characters in values with /", () => {
    const row = baseRow({ codeMarker: "HTTP|RPC" });
    const output = renderIntegrationLog([row]);
    assert.ok(output.includes("HTTP/RPC"));
    assert.ok(!output.includes("HTTP|RPC"));
  });

  test("handles null/undefined values gracefully", () => {
    const row = baseRow({ name: null, deletedAtUtc: undefined });
    assert.doesNotThrow(() => renderIntegrationLog([row]));
  });

  test("ends with a newline", () => {
    const output = renderIntegrationLog([]);
    assert.ok(output.endsWith("\n"));
  });
});

// ─── matchesDetector ─────────────────────────────────────────────────────────

describe("matchesDetector", () => {
  const kafkaDetector = INTEGRATION_DETECTORS.find((d) => d.id === "kafka-integration");
  const httpDetector = INTEGRATION_DETECTORS.find((d) => d.id === "external-http-api");

  test("matches primary pattern in any code file", () => {
    // \bnew\s+Kafka\b matches "new Kafka.Consumer" — dot after Kafka is a word boundary
    assert.ok(matchesDetector(kafkaDetector, "src/Consumer.cs", 'var c = new Kafka.Consumer(config);'));
  });

  test("does not match when content is unrelated", () => {
    assert.ok(!matchesDetector(kafkaDetector, "src/Service.cs", "var x = 1;"));
  });

  test("matches HttpClient in source file via primary pattern", () => {
    assert.ok(matchesDetector(httpDetector, "src/ApiClient.cs", "var client = new HttpClient();"));
  });

  test("matches hardcoded URL assignment in source file", () => {
    assert.ok(matchesDetector(httpDetector, "src/Config.cs", 'var baseUrl = "https://api.example.com";'));
  });

  test("matches hardcoded URL in new Uri() call", () => {
    assert.ok(matchesDetector(httpDetector, "src/Client.cs", 'new Uri("https://api.example.com")'));
  });

  test("does NOT match bare URL in source code comment (configPattern restricted)", () => {
    const content = "// see https://api.example.com for docs";
    assert.ok(!matchesDetector(httpDetector, "src/Service.cs", content));
  });

  test("DOES match bare URL in config file (configPattern applies)", () => {
    const content = 'endpoint: "https://api.example.com"';
    assert.ok(matchesDetector(httpDetector, "config/settings.yaml", content));
  });

  test("configPattern does not apply to non-config extension", () => {
    const content = "https://api.example.com";
    assert.ok(!matchesDetector(httpDetector, "src/Service.cs", content));
  });

  test("matches gRPC detector", () => {
    const grpc = INTEGRATION_DETECTORS.find((d) => d.id === "grpc-integration");
    assert.ok(matchesDetector(grpc, "src/Client.cs", "GrpcChannel.ForAddress(address)"));
  });
});

// ─── isCodeFile ──────────────────────────────────────────────────────────────

describe("isCodeFile", () => {
  test("accepts .cs file in src/", () => {
    assert.ok(isCodeFile("src/Services/PaymentService.cs"));
  });

  test("accepts .ts file in frontend/", () => {
    assert.ok(isCodeFile("frontend/src/api.ts"));
  });

  test("rejects file in /docs/ path", () => {
    assert.ok(!isCodeFile("docs/integrations/spec.cs"));
  });

  test("rejects file in /node_modules/", () => {
    assert.ok(!isCodeFile("node_modules/lib/index.js"));
  });

  test("rejects file in /.githooks/", () => {
    assert.ok(!isCodeFile(".githooks/integration-passports.validate.mjs"));
  });

  test("rejects file in /scripts/", () => {
    assert.ok(!isCodeFile("scripts/setup.ts"));
  });

  test("rejects unknown extension", () => {
    assert.ok(!isCodeFile("src/readme.txt"));
  });

  test("rejects file without matching scope pattern", () => {
    assert.ok(!isCodeFile("tools/helper.cs"));
  });

  test("accepts .py file in services/", () => {
    assert.ok(isCodeFile("services/worker/handler.py"));
  });

  // Extended scope patterns
  test("accepts .ts file in lib/", () => assert.ok(isCodeFile("lib/utils/client.ts")));
  test("accepts .cs file in api/", () => assert.ok(isCodeFile("api/controllers/endpoint.cs")));
  test("accepts .py file in core/", () => assert.ok(isCodeFile("core/services/handler.py")));
  test("accepts .ts file in functions/", () => assert.ok(isCodeFile("functions/handler/index.ts")));
  test("accepts .cs file in infrastructure/", () => assert.ok(isCodeFile("infrastructure/http/client.cs")));
  test("accepts .ts file in adapters/", () => assert.ok(isCodeFile("adapters/payment/stripe.ts")));
  test("accepts .ts file in workers/", () => assert.ok(isCodeFile("workers/consumer/index.ts")));
  test("accepts .java file in handlers/", () => assert.ok(isCodeFile("handlers/event/MessageHandler.java")));

  // Test directory exclusions
  test("rejects file in /tests/", () => assert.ok(!isCodeFile("src/tests/HttpClientTest.cs")));
  test("rejects file in /__tests__/", () => assert.ok(!isCodeFile("frontend/src/__tests__/api.test.ts")));
  test("rejects file in /spec/", () => assert.ok(!isCodeFile("services/spec/integration.spec.ts")));
  test("rejects file in /__mocks__/", () => assert.ok(!isCodeFile("src/__mocks__/http.ts")));

  // Root files (Variant A — depth 1 from cwd, no subdirectory)
  test("accepts root-level .ts file (no subdirectory)", () => assert.ok(isCodeFile("main.ts")));
  test("accepts root-level .cs file", () => assert.ok(isCodeFile("Program.cs")));
  test("accepts root-level .py file", () => assert.ok(isCodeFile("app.py")));
  test("rejects root file with unknown extension", () => assert.ok(!isCodeFile("README.txt")));

  // Variant A: moduleRoot provided — file directly in moduleRoot
  test("accepts file directly in moduleRoot when moduleRoot provided", () => {
    const cwd = process.cwd();
    assert.ok(isCodeFile("main.ts", cwd));
  });
  test("accepts file in scope pattern when moduleRoot provided", () => {
    const cwd = process.cwd();
    assert.ok(isCodeFile("src/services/client.ts", cwd));
  });
});

// ─── resolvePassportPath ─────────────────────────────────────────────────────

describe("resolvePassportPath", () => {
  test("resolves passport in same directory as log", () => {
    const result = normalizePath(
      resolvePassportPath(
        "docs/integrations/integrations-log.app.md",
        "integration-passport.kafka-integration.md"
      )
    );
    assert.ok(
      result.endsWith("docs/integrations/integration-passport.kafka-integration.md"),
      `Expected path to end with 'docs/integrations/integration-passport.kafka-integration.md', got: ${result}`
    );
  });

  test("returns absolute path", () => {
    const result = resolvePassportPath("docs/integrations/integrations-log.app.md", "integration-passport.svc.md");
    assert.ok(path.isAbsolute(result));
  });
});

// ─── createNewLogRow ─────────────────────────────────────────────────────────

describe("createNewLogRow", () => {
  const detector = INTEGRATION_DETECTORS.find((d) => d.id === "kafka-integration");

  test("sets integrationId from detector", () => {
    const row = createNewLogRow(detector, ["src/Consumer.cs"], TS);
    assert.equal(row.integrationId, "kafka-integration");
  });

  test("sets name from detector markerLabel", () => {
    const row = createNewLogRow(detector, ["src/Consumer.cs"], TS);
    assert.equal(row.name, "Kafka integration");
  });

  test("sets addedAtUtc and lastChangedAtUtc to timestamp", () => {
    const row = createNewLogRow(detector, ["src/Consumer.cs"], TS);
    assert.equal(row.addedAtUtc, TS);
    assert.equal(row.lastChangedAtUtc, TS);
  });

  test("deletedAtUtc is empty string", () => {
    const row = createNewLogRow(detector, ["src/Consumer.cs"], TS);
    assert.equal(row.deletedAtUtc, "");
  });

  test("codeMarker equals markerLabel only (no file paths)", () => {
    const row = createNewLogRow(detector, ["src/A.cs", "src/B.cs", "src/C.cs", "src/D.cs"], TS);
    assert.equal(row.codeMarker, detector.markerLabel);
    assert.ok(!row.codeMarker.includes("src/"), "codeMarker must not contain file paths");
  });

  test("codeMarker is stable regardless of file set", () => {
    const row1 = createNewLogRow(detector, ["src/Consumer.cs"], TS);
    const row2 = createNewLogRow(detector, ["src/A.cs", "src/B.cs"], TS);
    assert.equal(row1.codeMarker, row2.codeMarker, "codeMarker must be stable across different file sets");
  });

  test("single file: codeMarker equals markerLabel", () => {
    const row = createNewLogRow(detector, ["src/Consumer.cs"], TS);
    assert.equal(row.codeMarker, detector.markerLabel);
  });

  test("sets passportPath from detector", () => {
    const row = createNewLogRow(detector, ["src/Consumer.cs"], TS);
    assert.equal(row.passportPath, "integration-passport.kafka-integration.md");
  });

  test("logPathRelative is empty string initially", () => {
    const row = createNewLogRow(detector, ["src/Consumer.cs"], TS);
    assert.equal(row.logPathRelative, "");
  });

  test("stack is set from detector.stack", () => {
    const row = createNewLogRow(detector, ["src/Consumer.cs"], TS);
    assert.equal(row.stack, detector.stack);
  });

  test("scope is empty for detector with autoScope=null", () => {
    const row = createNewLogRow(detector, ["src/Consumer.cs"], TS);
    assert.equal(row.scope, "");
  });

  test("scope is set for detector with autoScope=external", () => {
    const openAiDetector = INTEGRATION_DETECTORS.find((d) => d.id === "openai-compatible-llm");
    const row = createNewLogRow(openAiDetector, ["src/LlmClient.ts"], TS);
    assert.equal(row.scope, "external");
  });
});

describe("integration-log conventions", () => {
  test("normalizes module names to lower kebab-case log names", () => {
    assert.match(
      path.basename(computeLogPathForModule("/tmp/MyProject.Api")),
      /^integrations-log\.myproject-api\.md$/,
    );
  });

  test("reads required fields even when the presentation marker is absent", () => {
    assert.equal(extractRequiredFieldValue("| **Статус** | Active |", "Статус"), "Active");
  });
});

// ─── detectProjectStacks ─────────────────────────────────────────────────────

describe("detectProjectStacks", () => {
  test("detects dotnet from .csproj", () => {
    const stacks = detectProjectStacks(["src/App.csproj", "src/Program.cs"]);
    assert.ok(stacks.has("dotnet"));
  });

  test("detects nodejs from package.json", () => {
    const stacks = detectProjectStacks(["package.json", "src/index.ts"]);
    assert.ok(stacks.has("nodejs"));
  });

  test("detects nodejs from .ts extension", () => {
    const stacks = detectProjectStacks(["src/app.ts"]);
    assert.ok(stacks.has("nodejs"));
  });

  test("detects python from requirements.txt", () => {
    const stacks = detectProjectStacks(["requirements.txt", "src/app.py"]);
    assert.ok(stacks.has("python"));
  });

  test("detects go from go.mod", () => {
    const stacks = detectProjectStacks(["go.mod", "main.go"]);
    assert.ok(stacks.has("go"));
  });

  test("detects java from pom.xml", () => {
    const stacks = detectProjectStacks(["pom.xml", "src/Main.java"]);
    assert.ok(stacks.has("java"));
  });

  test("detects multiple stacks simultaneously", () => {
    const stacks = detectProjectStacks(["go.mod", "package.json", "main.go", "src/app.ts"]);
    assert.ok(stacks.has("go"));
    assert.ok(stacks.has("nodejs"));
  });

  test("returns empty set when no indicators present", () => {
    const stacks = detectProjectStacks(["README.md", "Makefile"]);
    assert.equal(stacks.size, 0);
  });
});

// ─── validatePassport ────────────────────────────────────────────────────────

describe("validatePassport", () => {
  let tmpDir;

  before(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "passport-test-"));
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function write(filename, content) {
    const fullPath = path.join(tmpDir, filename);
    writeFileSync(fullPath, content, "utf8");
    return path.relative(process.cwd(), fullPath);
  }

  test("returns error when file does not exist", () => {
    const errors = validatePassport(path.join(tmpDir, "nonexistent.md"));
    assert.ok(errors.some((e) => e.includes("не найден")));
  });

  test("returns no errors for a valid passport", () => {
    const rel = write("valid.md", makePassport());
    const errors = validatePassport(rel);
    assert.deepEqual(errors, []);
  });

  test("errors when a required field is missing", () => {
    const content = makePassport().replace(/\*\*Статус\*\* \[ОБЯЗАТЕЛЬНО\].*\n/, "");
    const rel = write("missing-field.md", content);
    const errors = validatePassport(rel);
    assert.ok(errors.some((e) => e.includes("Статус")));
  });

  test("errors when a required field has placeholder value TBD", () => {
    const rel = write("tbd.md", makePassport({ "Статус": "TBD" }));
    const errors = validatePassport(rel);
    assert.ok(errors.some((e) => e.includes("Статус")));
  });

  test("errors when a required field is empty", () => {
    const rel = write("empty-field.md", makePassport({ "Протокол": "" }));
    const errors = validatePassport(rel);
    assert.ok(errors.some((e) => e.includes("Протокол")));
  });

  test("errors when changelog has template row without date/author", () => {
    const content =
      makePassport().replace("| 2024-01-01 | Author | Initial creation |", "| | | Первичное создание паспорта |");
    const rel = write("template-changelog.md", content);
    const errors = validatePassport(rel);
    assert.ok(errors.some((e) => e.includes("Changelog")));
  });

  test("errors when changelog has no filled entry", () => {
    const content = makePassport().replace("| 2024-01-01 | Author | Initial creation |", "");
    const rel = write("no-changelog.md", content);
    const errors = validatePassport(rel);
    assert.ok(errors.some((e) => e.includes("Changelog")));
  });

  test("errors for all missing required fields when passport is empty", () => {
    const rel = write("empty.md", "# Empty Passport\n");
    const errors = validatePassport(rel);
    assert.equal(errors.length, REQUIRED_PASSPORT_FIELDS.length + 1); // fields + changelog
  });
});
