import { describe, test, expect } from "bun:test";
import {
  mulberry32,
  intBetween,
  randomString,
  runProperty,
  applyRule,
  verify,
} from "../src/verifier";
import type { Property, Rule } from "../src/types";

describe("agent-verification-framework", () => {
  test("mulberry32 is deterministic for a fixed seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  test("intBetween stays within the inclusive range", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 1000; i++) {
      const v = intBetween(rng, 5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
    }
  });

  test("randomString produces the requested length", () => {
    expect(randomString(0)).toBe("");
    expect(randomString(12)).toHaveLength(12);
  });

  test("runProperty reports a counterexample when an invariant fails", () => {
    const rng = mulberry32(7);
    const p: Property<number> = {
      name: "always even",
      generate: () => intBetween(rng, 0, 10),
      check: (v) => v % 2 === 0,
    };
    const result = runProperty(p, 200);
    expect(result.passed).toBe(false);
    expect(result.failures).toBeGreaterThan(0);
    expect(typeof result.counterexample).toBe("number");
  });

  test("runProperty passes when the invariant always holds", () => {
    const p: Property<number> = {
      name: "in range",
      generate: () => intBetween(mulberry32(3), 0, 100),
      check: (v) => v >= 0 && v <= 100,
    };
    expect(runProperty(p, 500).passed).toBe(true);
  });

  test("applyRule validates a type rule at a dotted path", () => {
    const r: Rule = { kind: "type", path: "data.id", type: "string" };
    expect(applyRule(r, { data: { id: "abc" } }).passed).toBe(true);
    expect(applyRule(r, { data: { id: 42 } }).passed).toBe(false);
  });

  test("applyRule checks min/max/enum/matches rules", () => {
    const output = { score: 88, status: "ok", id: "a1b2" };
    expect(applyRule({ kind: "min", path: "score", min: 0 }, output).passed).toBe(true);
    expect(applyRule({ kind: "max", path: "score", max: 50 }, output).passed).toBe(false);
    expect(applyRule({ kind: "enum", path: "status", values: ["ok", "error"] }, output).passed).toBe(true);
    expect(applyRule({ kind: "matches", path: "id", pattern: "^[a-z0-9]+$" }, output).passed).toBe(true);
  });

  test("verify aggregates properties and rules into a report", () => {
    const properties: Property<unknown>[] = [
      {
        name: "score in range",
        generate: () => intBetween(mulberry32(5), 0, 100),
        check: (v) => typeof v === "number" && v >= 0 && v <= 100,
      },
    ];
    const rules: Rule[] = [
      { kind: "type", path: "id", type: "string" },
      { kind: "matches", path: "id", pattern: "^[a-z0-9-]+$" },
      { kind: "min", path: "score", min: 0 },
      { kind: "max", path: "score", max: 100 },
    ];
    const report = verify(properties, rules, { id: "agent-7f3a", score: 92 });
    expect(report.ok).toBe(true);
    expect(report.summary).toBe("PASS");
    expect(report.properties.length).toBe(1);
    expect(report.ruleResults.length).toBe(4);
  });

  test("verify fails the report when a rule is violated", () => {
    const report = verify([], [{ kind: "type", path: "id", type: "string" }], { id: 99 });
    expect(report.ok).toBe(false);
    expect(report.summary).toBe("FAIL");
  });
});
