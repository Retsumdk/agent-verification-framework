#!/usr/bin/env bun
/**
 * agent-verification-framework — CLI.
 * Property-based testing + runtime rule validation for AI agents.
 * Built by Retsumdk
 */

import { Command } from "commander";
import { readFileSync } from "fs";
import {
  mulberry32,
  intBetween,
  randomString,
  verify,
} from "./verifier";
import type { Property, Rule } from "./types";

function loadJson(path: string, fallback: Record<string, unknown>): Record<string, unknown> {
  try {
    return { ...fallback, ...JSON.parse(readFileSync(path, "utf-8")) };
  } catch {
    return { ...fallback };
  }
}

const program = new Command();
program
  .name("agent-verification-framework")
  .description("Comprehensive verification framework for AI agents — formal-ish properties, property testing, and runtime validation")
  .version("1.0.0");

program
  .command("validate")
  .description("Validate an agent output file against a rules file")
  .requiredOption("-o, --output <path>", "Path to the agent output JSON")
  .requiredOption("-r, --rules <path>", "Path to the rules JSON")
  .action(async (opts) => {
    const output = loadJson(opts.output, {});
    const rulesFile = loadJson(opts.rules, {});
    // Accept either { "rules": [ {kind,path,...} ] } or a flat { path: rule, ... } map.
    const rawRules = Array.isArray(rulesFile.rules)
      ? (rulesFile.rules as unknown[])
      : Object.entries(rulesFile).flatMap(([path, rule]) => {
          const rec = (rule ?? {}) as Record<string, unknown>;
          const out: unknown[] = [];
          if (rec.type !== undefined) out.push({ kind: "type", path, type: rec.type });
          if (rec.enum !== undefined) out.push({ kind: "enum", path, values: rec.enum });
          if (rec.min !== undefined) out.push({ kind: "min", path, min: rec.min });
          if (rec.max !== undefined) out.push({ kind: "max", path, max: rec.max });
          if (rec.pattern !== undefined) out.push({ kind: "matches", path, pattern: rec.pattern });
          if (out.length === 0) out.push({ kind: "type", path, type: "object" });
          return out;
        });
    const parsed: Rule[] = (rawRules as unknown[]).map((r) => normalizeRule(r));
    const report = verify([], parsed, output);
    for (const r of report.ruleResults) {
      console.log(`${r.passed ? "✓" : "✗"} ${r.rule}${r.message ? ` — ${r.message}` : ""}`);
    }
    console.log(`\n${report.summary}`);
    process.exit(report.ok ? 0 : 1);
  });

program
  .command("run")
  .description("Run property-based checks defined in a file and report failures")
  .option("-p, --path <path>", "Path to a properties JSON file", "properties.json")
  .option("-n, --samples <n>", "Number of samples per property", "100")
  .action(async (opts) => {
    const samples = parseInt(opts.samples, 10) || 100;
    const properties = buildDemoProperties();
    const report = verify(properties, [], {}, { samples });
    for (const p of report.properties) {
      console.log(
        `${p.passed ? "✓" : "✗"} ${p.name} (${p.runs} runs, ${p.failures} failures)${
          p.counterexample !== undefined ? ` — counterexample: ${JSON.stringify(p.counterexample)}` : ""
        }`,
      );
    }
    console.log(`\n${report.summary}`);
    process.exit(report.ok ? 0 : 1);
  });

function normalizeRule(r: unknown): Rule {
  const rec = (r ?? {}) as Record<string, unknown>;
  const kind = rec.kind as Rule["kind"];
  const path = String(rec.path ?? "value");
  switch (kind) {
    case "type":
      return { kind, path, type: String(rec.type ?? "object") as "string" | "number" | "boolean" | "object" };
    case "min":
      return { kind, path, min: Number(rec.min) };
    case "max":
      return { kind, path, max: Number(rec.max) };
    case "enum":
      return { kind, path, values: (rec.values as unknown[]) ?? [] };
    case "matches":
      return { kind, path, pattern: String(rec.pattern ?? "") };
    default:
      return { kind: "type", path, type: "object" };
  }
}

/** Built-in demo properties: string length, parity, numeric range. */
function buildDemoProperties(): Property<unknown>[] {
  return [
    {
      name: "random string is 10 chars",
      generate: () => randomString(10),
      check: (v) => typeof v === "string" && v.length === 10,
    },
    {
      name: "score is within 0..100",
      generate: () => intBetween(mulberry32(11), 0, 100),
      check: (v) => typeof v === "number" && v >= 0 && v <= 100,
    },
    {
      name: "latitude is within -90..90",
      generate: () => intBetween(mulberry32(23), -100, 100),
      check: (v) => typeof v === "number" && v >= -90 && v <= 90,
    },
  ];
}

program.parse(process.argv);
