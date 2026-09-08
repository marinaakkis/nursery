#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mode = process.argv[2];

const CODE_FILE_EXTENSIONS = new Set([
  ".cs", ".fs", ".vb", ".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".kt", ".go", ".rb", ".php", ".yaml", ".yml",
  ".json", ".xml", ".toml", ".ini",
]);

// URL pattern in external-http-api is restricted to these extensions to avoid false positives in source comments
const CONFIG_FILE_EXTENSIONS = new Set([".json", ".yaml", ".yml", ".toml", ".ini"]);

const EXCLUDED_PATH_SEGMENTS = [
  "/docs/", "/input/", "/.docs/", "/.cursor/", "/.claude/", "/.githooks/", "/scripts/", "/node_modules/",
  "/bin/", "/obj/", "/dist/", "/build/", "/.devcontainer/",
  "/test/", "/tests/", "/spec/", "/specs/", "/__tests__/", "/__mocks__/",
];

const STACK_INDICATORS = {
  dotnet:  { extensions: new Set([".cs", ".fs", ".vb"]),  files: [".csproj", ".sln", ".fsproj"] },
  nodejs:  { extensions: new Set([".ts", ".tsx", ".js", ".jsx"]), files: ["package.json", "tsconfig.json"] },
  python:  { extensions: new Set([".py"]), files: ["requirements.txt", "pyproject.toml", "setup.py"] },
  go:      { extensions: new Set([".go"]), files: ["go.mod"] },
  java:    { extensions: new Set([".java", ".kt"]), files: ["pom.xml", "build.gradle", "build.gradle.kts"] },
};

const PATTERN_FILES = {
  dotnet: new URL("./patterns/patterns.dotnet.mjs", import.meta.url).href,
  nodejs: new URL("./patterns/patterns.nodejs.mjs", import.meta.url).href,
  python: new URL("./patterns/patterns.python.mjs", import.meta.url).href,
  go:     new URL("./patterns/patterns.go.mjs", import.meta.url).href,
  java:   new URL("./patterns/patterns.java.mjs", import.meta.url).href,
};

const CODE_SCOPE_PATTERNS = [
  /\/src\//i, /\/output\/src\//i, /\/apps\//i, /\/services\//i, /\/backend\//i, /\/frontend\//i,
  /\/lib\//i, /\/api\//i, /\/core\//i, /\/packages\//i, /\/functions\//i, /\/workers\//i,
  /\/handlers\//i, /\/modules\//i, /\/infrastructure\//i, /\/adapters\//i,
  /\/integrations\//i, /\/plugins\//i, /\/jobs\//i, /\/tasks\//i,
];
const LOG_FILE_CANDIDATES = ["docs/integrations/integrations-log.*.md", "*/docs/integrations/integrations-log.*.md"];
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const INTEGRATION_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PASSPORT_FILE_PATTERN = /^integration-passport\.[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const PLACEHOLDER_PATTERNS = [/^$/, /^YYYY-MM-DD$/i, /\bTBD\b/i, /\bTODO\b/i, /\{[^}]+\}/u, /<[^>]+>/u];
const DELETED_PASSPORT_MARKERS = /(deleted|удален|удалена|выведено|decommission)/i;

const REQUIRED_PASSPORT_FIELDS = [
  "Название интеграции",
  "Внешняя система",
  "Владелец (бизнес)",
  "Дата создания",
  "Tier проекта",
  "Статус",
  "Направление",
  "Протокол",
  "Формат данных",
  "Способ вызова",
  "Метод аутентификации",
  "Где хранятся credentials",
  "Содержит персональные данные",
];

const INTEGRATION_DETECTORS = [
  {
    id: "openai-compatible-llm",
    stack: "OpenAI",
    autoScope: "external",
    markerLabel: "OpenAI-compatible chat completions",
    passportFileName: "integration-passport.openai-compatible-llm.md",
    patterns: [/\bOpenAiCompatibleLlmClient\b/i, /\/v1\/chat\/completions/i, /\bOpenAI\b/i],
  },
  {
    id: "grpc-integration",
    stack: "gRPC",
    autoScope: null,
    markerLabel: "gRPC integration",
    passportFileName: "integration-passport.grpc-integration.md",
    // Requires actual gRPC client usage: C# GrpcChannel/GrpcClient, Go grpc.Dial/grpc.NewClient or import, JS @grpc/* import.
    // Bare "gRPC" name mentions in strings and comments do NOT trigger.
    patterns: [
      /\bGrpcChannel\b/,
      /\bGrpcClient\b/,
      /\bgrpc\.Dial\b/,
      /\bgrpc\.NewClient\b/,
      /['"]google\.golang\.org\/grpc['"]/,
      /from\s+['"]@grpc\//i,
    ],
  },
  {
    id: "graphql-integration",
    stack: "GraphQL",
    autoScope: null,
    markerLabel: "GraphQL integration",
    passportFileName: "integration-passport.graphql-integration.md",
    // Requires actual GraphQL client usage: ApolloClient/GraphQLClient instantiation, Apollo/graphql imports, gql template tag.
    // Bare "GraphQL" name mentions in strings and comments do NOT trigger.
    patterns: [
      /\bnew\s+ApolloClient\b/,
      /\bnew\s+GraphQLClient\b/,
      /\bApolloProvider\b/,
      /from\s+['"]graphql['"]/i,
      /from\s+['"]@apollo\//i,
      /require\s*\(\s*['"]graphql['"]\s*\)/i,
      /gql\s*`/,
      /['"].*graphql-go[^'"]*['"]/i,
    ],
  },
  {
    id: "soap-integration",
    stack: "SOAP",
    autoScope: null,
    markerLabel: "SOAP integration",
    passportFileName: "integration-passport.soap-integration.md",
    // Requires actual SOAP client usage: SoapClient class, WCF bindings/service references, WSDL, soap npm import.
    patterns: [
      /\bSoapClient\b/i,
      /\bBasicHttpBinding\b/,
      /\bServiceReference\b/,
      /\.wsdl\b/i,
      /from\s+['"]soap['"]/i,
      /require\s*\(\s*['"]soap['"]\s*\)/i,
    ],
  },
  {
    id: "sftp-integration",
    stack: "SFTP",
    autoScope: null,
    markerLabel: "SFTP integration",
    passportFileName: "integration-passport.sftp-integration.md",
    // Requires actual SFTP client usage: SftpClient class, SSH.NET namespace, ssh2/ssh2-sftp-client import.
    patterns: [
      /\bSftpClient\b/i,
      /\bRenci\.SshNet\b/,
      /from\s+['"]ssh2-sftp-client['"]/i,
      /from\s+['"]ssh2['"]/i,
      /require\s*\(\s*['"]ssh2['"]\s*\)/i,
    ],
  },
  {
    id: "kafka-integration",
    stack: "Kafka",
    autoScope: null,
    markerLabel: "Kafka integration",
    passportFileName: "integration-passport.kafka-integration.md",
    // Requires actual Kafka client usage: new Kafka(...), consumer/producer classes, Confluent.Kafka namespace,
    // kafkajs import, or a Go import path containing kafka/sarama.
    // Bare "Kafka" name mentions in strings and comments do NOT trigger.
    patterns: [
      /\bnew\s+Kafka\b/,
      /\bKafkaConsumer\b/,
      /\bKafkaProducer\b/,
      /\bKafkaClient\b/,
      /\bConfluent\.Kafka\b/,
      /from\s+['"]kafkajs['"]/i,
      /require\s*\(\s*['"]kafkajs['"]\s*\)/i,
      /['"]github\.com\/[^'"]*kafka[^'"]*['"]/i,
      /['"]github\.com\/IBM\/sarama['"]/,
    ],
  },
  {
    id: "rabbitmq-integration",
    stack: "RabbitMQ",
    autoScope: null,
    markerLabel: "RabbitMQ integration",
    passportFileName: "integration-passport.rabbitmq-integration.md",
    // Requires actual RabbitMQ/AMQP client usage: amqp:// connection string, C# BasicPublish/BasicConsume/RabbitMQ.Client,
    // amqplib import, Go amqp.Dial, or a Go import path containing amqp/rabbitmq.
    // Bare "RabbitMQ" name mentions in strings and comments do NOT trigger.
    patterns: [
      /amqp:\/\//,
      /\bBasicPublish\b/,
      /\bBasicConsume\b/,
      /\bRabbitMQ\.Client\b/i,
      /from\s+['"]amqplib['"]/i,
      /require\s*\(\s*['"]amqplib['"]\s*\)/i,
      /\bamqp\.Dial\b/,
      /['"]github\.com\/[^'"]*(?:amqp|rabbitmq)[^'"]*['"]/i,
    ],
  },
  {
    id: "webhook-integration",
    stack: "Webhook",
    autoScope: null,
    markerLabel: "Webhook integration",
    passportFileName: "integration-passport.webhook-integration.md",
    // Requires actual webhook client/receiver code: explicit client/sender/receiver classes or HMAC signature headers.
    // Bare "Webhook" name mentions in strings and comments do NOT trigger.
    patterns: [
      /\bWebhookClient\b/i,
      /\bWebhookSender\b/i,
      /\bWebhookReceiver\b/i,
      /X-Hub-Signature\b/i,
      /X-Webhook-Signature\b/i,
    ],
  },
  {
    id: "external-http-api",
    stack: "REST",
    autoScope: null,
    markerLabel: "External HTTP API",
    passportFileName: "integration-passport.external-http-api.md",
    patterns: [
      /\bAddHttpClient\b/i,
      /\bHttpClient\b/i,
      // Hardcoded base URLs: variable assignments and constructor arguments
      /(?:url|endpoint|baseUrl|baseUri|baseAddress|host)\s*(?:=|:)\s*["'`]https?:\/\//i,
      /new\s+Uri\s*\(\s*["'`]https?:\/\//i,
      /new\s+URL\s*\(\s*["'`]https?:\/\//i,
    ],
    // Applied only to config files — localhost, loopback, and Docker-internal addresses are excluded
    configPatterns: [/https?:\/\/(?!localhost\b|127\.|0\.0\.0\.0\b)[a-zA-Z0-9][\w.-]*\.[a-zA-Z]{2,}/i],
  },
];

function runGit(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch (err) {
    throw new Error(`git ${args.join(" ")} failed: ${err.message}`, { cause: err });
  }
}

function runGitSafe(args) {
  try {
    return runGit(args);
  } catch (error) {
    const cause = error.cause ?? error;
    if (cause && typeof cause === "object" && "status" in cause) {
      return "";
    }
    throw error;
  }
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function nowUtc() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function listStagedFiles() {
  return runGitSafe(["diff", "--cached", "--name-only", "--diff-filter=ACM"])
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function listFilesByPathspec(pathspecs) {
  const trackedOutput = runGitSafe(["ls-files", ...pathspecs]);
  const untrackedOutput = runGitSafe(["ls-files", "--others", "--exclude-standard", ...pathspecs]);
  const all = `${trackedOutput}\n${untrackedOutput}`.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return [...new Set(all)];
}

function listRepoFiles() {
  const trackedOutput = runGitSafe(["ls-files"]);
  const untrackedOutput = runGitSafe(["ls-files", "--others", "--exclude-standard"]);
  const all = `${trackedOutput}\n${untrackedOutput}`.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return [...new Set(all)];
}

function isCodeFile(filePath, moduleRoot = null) {
  const normalized = `/${normalizePath(filePath)}`;
  const extension = path.extname(normalized).toLowerCase();
  if (!CODE_FILE_EXTENSIONS.has(extension)) return false;
  if (EXCLUDED_PATH_SEGMENTS.some((segment) => normalized.includes(segment))) return false;
  if (moduleRoot !== null) {
    const relPath = normalizePath(path.relative(moduleRoot, path.resolve(filePath)));
    if (!relPath.includes("/")) return true;
  } else {
    // Fallback without moduleRoot: root-level file (no directory separator in path)
    const parts = normalizePath(filePath).split("/");
    if (parts.length === 1) return true;
  }
  return CODE_SCOPE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function detectProjectStacks(allFiles) {
  const detected = new Set();
  for (const [stackId, indicator] of Object.entries(STACK_INDICATORS)) {
    const hasExt = allFiles.some((f) => indicator.extensions.has(path.extname(f).toLowerCase()));
    const hasFile = indicator.files.some((name) =>
      allFiles.some((f) => normalizePath(f).endsWith(`/${name}`) || normalizePath(f) === name)
    );
    if (hasExt || hasFile) detected.add(stackId);
  }
  return detected;
}

async function loadDetectors(stacks) {
  const toLoad = stacks.size > 0 ? stacks : new Set(Object.keys(PATTERN_FILES));
  const detectors = [];
  for (const stackId of toLoad) {
    const fileUrl = PATTERN_FILES[stackId];
    if (!fileUrl) continue;
    try {
      const module = await import(fileUrl);
      detectors.push(...module.DETECTORS);
    } catch {
      // pattern file not found — skip silently
    }
  }
  // Deduplicate by id (same integration may appear in multiple stacks)
  return [...new Map(detectors.map((d) => [d.id, d])).values()];
}

function matchesDetector(detector, filePath, content) {
  if (detector.patterns.some((p) => p.test(content))) return true;
  if (detector.configPatterns) {
    const ext = path.extname(filePath).toLowerCase();
    if (CONFIG_FILE_EXTENSIONS.has(ext) && detector.configPatterns.some((p) => p.test(content))) return true;
  }
  return false;
}

function findModuleRoot(absFilePath) {
  const cwd = process.cwd();
  let current = path.dirname(absFilePath);
  while (true) {
    if (existsSync(path.join(current, "docs"))) {
      return current;
    }
    if (current === cwd || current === path.dirname(current)) {
      return cwd;
    }
    current = path.dirname(current);
  }
}

function computeLogPathForModule(moduleRootAbs) {
  const projectName = path
    .basename(moduleRootAbs)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";
  return path.join(moduleRootAbs, "docs", "integrations", `integrations-log.${projectName}.md`);
}

function createNewLogRow(detector, filePaths, timestamp) {
  return {
    integrationId: detector.id,
    name: detector.markerLabel,
    stack: detector.stack ?? "",
    scope: detector.autoScope ?? "",
    addedAtUtc: timestamp,
    lastChangedAtUtc: timestamp,
    deletedAtUtc: "",
    codeMarker: detector.markerLabel,
    passportPath: detector.passportFileName,
    logPathRelative: "",
  };
}

function updatePassportCodeMarker(passportPathAbs, filePaths) {
  if (!existsSync(passportPathAbs)) return;
  const content = readFileSync(passportPathAbs, "utf8");
  const fileList = filePaths.slice(0, 5).join("; ");
  const updated = content.replace(
    /(\|\s*\*\*Code Marker\*\*\s*\|)[^\n]*/,
    `$1 ${fileList} |`
  );
  if (updated !== content) {
    writeFileSync(passportPathAbs, updated, "utf8");
  }
}

function detectIntegrationsByModule(files) {
  // `${moduleKey}\x00${detectorId}` -> Set of matching file paths
  const matchedFiles = new Map();
  const timestamp = nowUtc();

  for (const filePath of files) {
    const fullPath = path.resolve(filePath);
    const moduleRootAbs = findModuleRoot(fullPath);
    if (!isCodeFile(filePath, moduleRootAbs)) continue;
    let content;
    try {
      content = readFileSync(fullPath, "utf8");
    } catch {
      continue;
    }
    const moduleKey = normalizePath(moduleRootAbs);

    for (const detector of INTEGRATION_DETECTORS) {
      if (!matchesDetector(detector, filePath, content)) continue;
      const entryKey = `${moduleKey}\x00${detector.id}`;
      if (!matchedFiles.has(entryKey)) matchedFiles.set(entryKey, new Set());
      matchedFiles.get(entryKey).add(normalizePath(filePath));
    }
  }

  const result = new Map();
  for (const [entryKey, filePaths] of matchedFiles) {
    const sepIdx = entryKey.indexOf("\x00");
    const moduleKey = entryKey.slice(0, sepIdx);
    const detectorId = entryKey.slice(sepIdx + 1);
    const detector = INTEGRATION_DETECTORS.find((d) => d.id === detectorId);
    const sortedPaths = [...filePaths].sort();
    if (!result.has(moduleKey)) result.set(moduleKey, new Map());
    result.get(moduleKey).set(detectorId, {
      row: createNewLogRow(detector, sortedPaths, timestamp),
      filePaths: sortedPaths,
    });
  }

  for (const [, moduleEntries] of result.entries()) {
    if (moduleEntries.has("openai-compatible-llm") && moduleEntries.has("external-http-api")) {
      moduleEntries.delete("external-http-api");
    }
  }

  return result;
}

function parseIntegrationLog(logPathRelative, content) {
  const rows = [];
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith("|") || !line.endsWith("|")) {
      continue;
    }
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim().replace(/^`+|`+$/g, ""));
    if (cells.length < 6) {
      continue;
    }
    const joined = cells.join(" ").toLowerCase();
    if (joined.includes("integration id") || cells.every((cell) => /^:?-{3,}:?$/.test(cell))) {
      continue;
    }

    if (cells.length >= 9) {
      // Current 9-column format: ID | Name | Stack | Scope | Added | LastChanged | Deleted | Marker | Passport
      rows.push({
        integrationId: cells[0],
        name: cells[1],
        stack: cells[2],
        scope: cells[3],
        addedAtUtc: cells[4],
        lastChangedAtUtc: cells[5],
        deletedAtUtc: cells[6],
        codeMarker: cells[7],
        passportPath: cells[8],
        logPathRelative,
      });
      continue;
    }

    if (cells.length >= 7) {
      // Legacy 7-column format: ID | Name | Added | LastChanged | Deleted | Marker | Passport
      rows.push({
        integrationId: cells[0],
        name: cells[1],
        stack: "",
        scope: "",
        addedAtUtc: cells[2],
        lastChangedAtUtc: cells[3],
        deletedAtUtc: cells[4],
        codeMarker: cells[5],
        passportPath: cells[6],
        logPathRelative,
      });
      continue;
    }

    // Legacy 6-column format: ID | Added | LastChanged | Deleted | Marker | Passport
    rows.push({
      integrationId: cells[0],
      name: "",
      stack: "",
      scope: "",
      addedAtUtc: cells[1],
      lastChangedAtUtc: cells[2],
      deletedAtUtc: cells[3],
      codeMarker: cells[4],
      passportPath: cells[5],
      logPathRelative,
    });
  }
  return rows;
}

function validateLogRows(rows, logPathRelative) {
  const errors = [];
  const ids = new Set();

  for (const row of rows) {
    if (!INTEGRATION_ID_PATTERN.test(row.integrationId)) {
      errors.push(`${logPathRelative}: Integration ID "${row.integrationId}" должен быть в kebab-case.`);
    }
    if (ids.has(row.integrationId)) {
      errors.push(`${logPathRelative}: дублирующийся Integration ID "${row.integrationId}".`);
    }
    ids.add(row.integrationId);

    if (!ISO_UTC_PATTERN.test(row.addedAtUtc)) {
      errors.push(`${logPathRelative}: Added At UTC для "${row.integrationId}" должен быть в формате RFC3339 UTC.`);
    }
    if (!ISO_UTC_PATTERN.test(row.lastChangedAtUtc)) {
      errors.push(`${logPathRelative}: Last Changed At UTC для "${row.integrationId}" должен быть в формате RFC3339 UTC.`);
    }
    if (row.deletedAtUtc && !ISO_UTC_PATTERN.test(row.deletedAtUtc)) {
      errors.push(`${logPathRelative}: Deleted At UTC для "${row.integrationId}" должен быть пустым или RFC3339 UTC.`);
    }
    if (!row.codeMarker || PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(row.codeMarker))) {
      errors.push(`${logPathRelative}: Code Marker для "${row.integrationId}" не заполнен.`);
    }

    // Scope is required for active rows
    if (!row.deletedAtUtc) {
      if (!row.scope || (row.scope !== "external" && row.scope !== "internal")) {
        errors.push(`${logPathRelative}: Scope для "${row.integrationId}" должен быть "external" или "internal".`);
      }
    }

    // Passport Path is required only for external active rows
    const isExternal = !row.deletedAtUtc && row.scope === "external";
    if (isExternal) {
      if (!row.passportPath || row.passportPath === "-" || PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(row.passportPath))) {
        errors.push(`${logPathRelative}: Passport Path для "${row.integrationId}" (external) не заполнен.`);
      } else if (!PASSPORT_FILE_PATTERN.test(row.passportPath)) {
        errors.push(
          `${logPathRelative}: Passport Path для "${row.integrationId}" должен соответствовать шаблону integration-passport.{integration-name}.md.`
        );
      }
    }
  }

  return errors;
}

function renderIntegrationLog(rows) {
  const header = [
    "# Integration Log",
    "",
    "Технический журнал для активации и валидации git-хуков `pre-commit` и `pre-push`.",
    "",
    "Правила интерпретации состояния:",
    "- active: `Deleted At UTC` пустой.",
    "- deleted: `Deleted At UTC` заполнен.",
    "Scope: `external` — паспорт обязателен; `internal` — только запись, паспорт не нужен.",
    "",
    "| Integration ID | Name | Stack | Scope | Added At UTC | Last Changed At UTC | Deleted At UTC | Code Marker | Passport Path |",
    "|---|---|---|---|---|---|---|---|---|",
  ];

  const body = rows
    .sort((a, b) => a.integrationId.localeCompare(b.integrationId))
    .map((row) => {
      const safe = (value) => String(value ?? "").replace(/\|/g, "/");
      return [
        safe(row.integrationId),
        safe(row.name),
        safe(row.stack),
        safe(row.scope),
        safe(row.addedAtUtc),
        safe(row.lastChangedAtUtc),
        safe(row.deletedAtUtc),
        safe(row.codeMarker),
        safe(row.passportPath),
      ];
    })
    .map((cells) => `| ${cells.join(" | ")} |`);

  return `${header.concat(body).join("\n")}\n`;
}

// Passports live in the same directory as their integrations-log file
function resolvePassportPath(logPathRelative, passportFileName) {
  return path.resolve(path.dirname(path.resolve(logPathRelative)), passportFileName);
}

function syncIntegrationLogs(hookMode) {
  const files = hookMode === "pre-commit" ? listStagedFiles() : listRepoFiles();
  const detectedByModule = detectIntegrationsByModule(files);
  const existingLogs = listFilesByPathspec(LOG_FILE_CANDIDATES).map((file) => normalizePath(file));
  const moduleRoots = new Map();
  const duplicateLogErrors = [];
  const codeModuleRoots = new Set();

  for (const filePath of files) {
    const moduleRoot = normalizePath(findModuleRoot(path.resolve(filePath)));
    if (isCodeFile(filePath, moduleRoot)) codeModuleRoots.add(moduleRoot);
  }

  for (const logPath of existingLogs) {
    const moduleRoot = normalizePath(path.resolve(logPath, "..", "..", ".."));
    if (moduleRoots.has(moduleRoot)) duplicateLogErrors.push(`${moduleRoot}: найдено несколько integrations-log файлов.`);
    else moduleRoots.set(moduleRoot, path.resolve(logPath));
  }
  for (const [moduleRoot] of detectedByModule.entries()) {
    if (!moduleRoots.has(moduleRoot)) moduleRoots.set(moduleRoot, computeLogPathForModule(moduleRoot));
  }

  const changedLogFiles = [];
  const syncedRows = [];
  const validationErrors = [...duplicateLogErrors];
  const newUnscopedRows = [];
  const timestamp = nowUtc();

  for (const [moduleRoot, logPathAbs] of moduleRoots.entries()) {
    const moduleEntries = detectedByModule.get(moduleRoot) ?? new Map();
    const logPathRelative = normalizePath(path.relative(process.cwd(), logPathAbs));
    let existingRows = [];
    let originalContent = "";

    if (existsSync(logPathAbs)) {
      originalContent = readFileSync(logPathAbs, "utf8");
      existingRows = parseIntegrationLog(logPathRelative, originalContent);
    }

    const byId = new Map(existingRows.map((row) => [row.integrationId, row]));

    for (const [integrationId, detectedEntry] of moduleEntries.entries()) {
      const detectedRow = detectedEntry.row;
      const existing = byId.get(integrationId);
      if (!existing) {
        byId.set(integrationId, { ...detectedRow, logPathRelative });
        if (!detectedRow.scope) newUnscopedRows.push({ ...detectedRow, logPathRelative });
        continue;
      }

      const wasDeleted = Boolean(existing.deletedAtUtc);
      const markerChanged = existing.codeMarker !== detectedRow.codeMarker;
      if (wasDeleted || markerChanged || !ISO_UTC_PATTERN.test(existing.lastChangedAtUtc)) {
        existing.lastChangedAtUtc = timestamp;
      }
      existing.deletedAtUtc = "";
      existing.codeMarker = detectedRow.codeMarker;
      if (!existing.name && detectedRow.name) {
        existing.name = detectedRow.name;
      }
      // Preserve user-set scope; only auto-fill if empty and detector has autoScope
      if (!existing.scope && detectedRow.scope) {
        existing.scope = detectedRow.scope;
      }
      // Auto-fill stack if missing
      if (!existing.stack && detectedRow.stack) {
        existing.stack = detectedRow.stack;
      }
      if (!ISO_UTC_PATTERN.test(existing.addedAtUtc)) {
        existing.addedAtUtc = timestamp;
      }
      const invalidPassportPath =
        !existing.passportPath || existing.passportPath.includes(" ") || PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(existing.passportPath));
      if (invalidPassportPath) {
        existing.passportPath = detectedRow.passportPath;
      }
    }

    // Deletions are only applied on pre-push — pre-commit only discovers new integrations
    if (hookMode === "pre-push" && codeModuleRoots.has(moduleRoot)) {
      for (const [integrationId, existing] of byId.entries()) {
        if (moduleEntries.has(integrationId)) continue;
        if (!existing.deletedAtUtc) {
          existing.deletedAtUtc = timestamp;
        }
      }
    }

    const finalRows = [...byId.values()].map((row) => ({ ...row, logPathRelative }));
    for (const row of finalRows) {
      if (ISO_UTC_PATTERN.test(row.addedAtUtc) && ISO_UTC_PATTERN.test(row.lastChangedAtUtc)) {
        if (row.lastChangedAtUtc < row.addedAtUtc) {
          row.lastChangedAtUtc = row.addedAtUtc;
        }
      }
      if (row.deletedAtUtc && ISO_UTC_PATTERN.test(row.lastChangedAtUtc) && row.deletedAtUtc < row.lastChangedAtUtc) {
        row.deletedAtUtc = row.lastChangedAtUtc;
      }
    }

    const logDir = path.dirname(logPathAbs);
    mkdirSync(logDir, { recursive: true });

    const rendered = renderIntegrationLog(finalRows);
    if (rendered !== originalContent) {
      writeFileSync(logPathAbs, rendered, "utf8");
      changedLogFiles.push(logPathRelative);
    }

    for (const [integrationId, detectedEntry] of moduleEntries.entries()) {
      const row = byId.get(integrationId);
      if (!row || row.deletedAtUtc) continue;
      if (!row.passportPath || PLACEHOLDER_PATTERNS.some((p) => p.test(row.passportPath))) continue;
      const passportAbs = resolvePassportPath(logPathRelative, row.passportPath);
      updatePassportCodeMarker(passportAbs, detectedEntry.filePaths);
    }

    const newlyCreatedUnscopedIds = new Set(newUnscopedRows.filter((row) => row.logPathRelative === logPathRelative).map((row) => row.integrationId));
    validationErrors.push(...validateLogRows(finalRows, logPathRelative).filter((error) => ![...newlyCreatedUnscopedIds].some((id) => error.includes(`Scope для "${id}"`))));
    syncedRows.push(...finalRows);
  }

  return { changedLogFiles, syncedRows, validationErrors, newUnscopedRows };
}

function isPlaceholder(value) {
  const normalized = String(value ?? "").trim();
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized));
}

function extractRequiredFieldValue(content, fieldName) {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\|\\s*\\*\\*${escaped}\\*\\*(?:\\s*\\[ОБЯЗАТЕЛЬНО\\])?\\s*\\|\\s*([^|]*)\\|`, "u");
  const match = content.match(pattern);
  return match?.[1]?.trim() ?? null;
}

function validatePassport(passportPathRelative) {
  const fullPath = path.resolve(passportPathRelative);
  if (!existsSync(fullPath)) {
    return [`Файл паспорта не найден: ${passportPathRelative}`];
  }

  const errors = [];
  const content = readFileSync(fullPath, "utf8");
  for (const fieldName of REQUIRED_PASSPORT_FIELDS) {
    const value = extractRequiredFieldValue(content, fieldName);
    if (value === null) {
      errors.push(`Не найдена строка обязательного поля: "${fieldName}".`);
      continue;
    }
    if (isPlaceholder(value)) {
      errors.push(`Поле "${fieldName}" не заполнено корректно: "${value || "<пусто>"}".`);
    }
  }

  if (/^\|\s*\|\s*\|\s*\|\s*Первичное создание паспорта\s*\|/m.test(content)) {
    errors.push('В секции "Changelog" осталась шаблонная строка без даты и автора.');
  }
  if (!/^\|\s*\d{4}-\d{2}-\d{2}\s*\|\s*[^|]+\|\s*[^|]+\|/m.test(content)) {
    errors.push('В секции "Changelog" должна быть минимум одна заполненная запись (дата, автор, изменение).');
  }
  return errors;
}

function isActive(row) {
  return !row.deletedAtUtc;
}

function fail(header, lines) {
  console.error(header);
  for (const line of lines) {
    console.error(`- ${line}`);
  }
  process.exit(1);
}

function runPreCommit() {
  const syncResult = syncIntegrationLogs("pre-commit");

  if (syncResult.validationErrors.length > 0) {
    fail("pre-commit: формат integrations-log некорректен.", syncResult.validationErrors);
  }
  if (syncResult.changedLogFiles.length > 0) {
    fail(
      "pre-commit: integrations-log был создан/обновлен автоматически.",
      [
        ...syncResult.changedLogFiles.map((file) => `Добавьте в индекс: ${file}`),
        ...syncResult.newUnscopedRows.map((row) => `${row.logPathRelative}: заполните Scope (external или internal) для "${row.integrationId}" перед git add.`),
        "Повторите commit после `git add` обновленных integrations-log.",
      ]
    );
  }

  const activeRows = syncResult.syncedRows.filter(isActive);
  if (activeRows.length === 0) {
    process.exit(0);
  }

  const emptyScopeRows = activeRows.filter((row) => !row.scope);
  if (emptyScopeRows.length > 0) {
    fail(
      "pre-commit: поле Scope не заполнено для интеграций.",
      [
        ...emptyScopeRows.map((row) => `${row.logPathRelative}: заполните Scope ("external" или "internal") для "${row.integrationId}".`),
        "Обновите integrations-log и повторите git add + commit.",
      ]
    );
  }

  const externalRows = activeRows.filter((row) => row.scope === "external");
  const missingPassports = [];
  for (const row of externalRows) {
    const passportAbs = resolvePassportPath(row.logPathRelative, row.passportPath);
    if (!existsSync(passportAbs)) {
      missingPassports.push(
        `${row.logPathRelative}: отсутствует паспорт ${normalizePath(path.relative(process.cwd(), passportAbs))} для "${row.integrationId}".`
      );
    }
  }

  if (missingPassports.length > 0) {
    fail("pre-commit: отсутствуют файлы паспортов для active-интеграций.", missingPassports);
  }
}

function runPrePush() {
  const syncResult = syncIntegrationLogs("pre-push");

  if (syncResult.validationErrors.length > 0) {
    fail("pre-push: формат integrations-log некорректен.", syncResult.validationErrors);
  }
  if (syncResult.changedLogFiles.length > 0) {
    fail(
      "pre-push: integrations-log был создан/обновлен автоматически.",
      [
        ...syncResult.changedLogFiles.map((file) => `Обновите и зафиксируйте: ${file}`),
        "Повторите push после commit с обновленным integrations-log.",
      ]
    );
  }

  const errors = [];

  const emptyScopeActive = syncResult.syncedRows.filter((r) => isActive(r) && !r.scope);
  for (const row of emptyScopeActive) {
    errors.push(`${row.logPathRelative}: Scope не заполнен для "${row.integrationId}". Установите "external" или "internal".`);
  }

  for (const row of syncResult.syncedRows) {
    // internal active rows require no passport
    if (isActive(row) && row.scope === "internal") continue;
    // active with no scope — already reported above
    if (isActive(row) && !row.scope) continue;

    const passportAbs = resolvePassportPath(row.logPathRelative, row.passportPath);
    const passportRelative = normalizePath(path.relative(process.cwd(), passportAbs));

    if (!existsSync(passportAbs)) {
      errors.push(`${row.logPathRelative}: отсутствует паспорт ${passportRelative} для "${row.integrationId}".`);
      continue;
    }

    if (isActive(row)) {
      const validationErrors = validatePassport(passportRelative);
      for (const validationError of validationErrors) {
        errors.push(`${row.logPathRelative} -> ${passportRelative}: ${validationError}`);
      }
      continue;
    }

    const passportContent = readFileSync(passportAbs, "utf8");
    if (!DELETED_PASSPORT_MARKERS.test(passportContent)) {
      errors.push(
        `${row.logPathRelative} -> ${passportRelative}: для удаленной интеграции нужна отметка в паспорте (Deleted/Удалена/Выведено).`
      );
    }
  }

  if (errors.length > 0) {
    fail("pre-push: проверка integrations-log и паспортов завершилась ошибками.", errors);
  }
}

async function main() {
  if (mode !== "pre-commit" && mode !== "pre-push") {
    console.error("Usage: node .githooks/integration-passports.validate.mjs <pre-commit|pre-push> [--stack=dotnet,nodejs,...]");
    process.exit(1);
  }

  if (mode === "pre-push") {
    try { execFileSync("git", ["rev-parse", "--verify", "--quiet", "HEAD"], { stdio: "ignore" }); }
    catch { console.warn("integration-passports: no HEAD yet; pre-push validation skipped."); return; }
  }

  // Resolve detectors: --stack flag > auto-detect > all
  const stackArg = process.argv.find((a) => a.startsWith("--stack="));
  let stacks;
  if (stackArg) {
    stacks = new Set(stackArg.replace("--stack=", "").split(",").map((s) => s.trim()).filter(Boolean));
  } else {
    const allFiles = listRepoFiles();
    stacks = detectProjectStacks(allFiles);
    if (stacks.size === 0) {
      console.warn("integration-passports: stack not detected, applying all pattern files.");
    }
  }

  const loadedDetectors = await loadDetectors(stacks);
  // Merge with built-in detectors for backward compatibility (built-ins used as fallback)
  const mergedById = new Map([
    ...INTEGRATION_DETECTORS.map((d) => [d.id, d]),
    ...loadedDetectors.map((d) => [d.id, d]),
  ]);
  const activeDetectors = [...mergedById.values()];

  // Override global INTEGRATION_DETECTORS for this run
  INTEGRATION_DETECTORS.length = 0;
  INTEGRATION_DETECTORS.push(...activeDetectors);

  if (mode === "pre-commit") {
    runPreCommit();
  } else {
    runPrePush();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export {
  parseIntegrationLog,
  validateLogRows,
  renderIntegrationLog,
  matchesDetector,
  isCodeFile,
  resolvePassportPath,
  createNewLogRow,
  normalizePath,
  detectProjectStacks,
  loadDetectors,
  INTEGRATION_DETECTORS,
  REQUIRED_PASSPORT_FIELDS,
  validatePassport,
  computeLogPathForModule,
  extractRequiredFieldValue,
};
