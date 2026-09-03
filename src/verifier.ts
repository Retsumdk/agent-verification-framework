/**
 * agent-verification-framework — core engine.
 * Property-based testing, runtime rule validation, and a verify() orchestrator.
 * Built by Retsumdk
 */

import type {
  Property,
  PropertyResult,
  Rule,
  RuleResult,
  VerificationReport,
} from "./types";

/** Deterministic PRNG (mulberry32) so property runs are reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform integer in [min, max] inclusive. */
export function intBetween(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Random lowercase alphanumeric string of the given length. */
export function randomString(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/** Run one property across `samples` generated inputs. */
export function runProperty<T>(property: Property<T>, samples: number): PropertyResult {
  let failures = 0;
  let counterexample: unknown;
  for (let i = 0; i < samples; i++) {
    const value = property.generate();
    if (!property.check(value)) {
      failures += 1;
      if (counterexample === undefined) counterexample = value;
    }
  }
  return {
    name: property.name,
    passed: failures === 0,
    runs: samples,
    failures,
    counterexample,
  };
}

/** Read a value from an object at a dotted path (e.g. "data.count"). */
function readPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/** Apply a single rule to an output object. */
export function applyRule(rule: Rule, output: unknown): RuleResult {
  const value = readPath(output, rule.path);
  const label = `${rule.kind}@${rule.path}`;
  switch (rule.kind) {
    case "type": {
      const actual = Array.isArray(value) ? "array" : typeof value;
      const ok = actual === rule.type;
      return { rule: label, passed: ok, message: ok ? "" : `expected ${rule.type}, got ${actual}` };
    }
    case "min": {
      const ok = typeof value === "number" && value >= rule.min;
      return { rule: label, passed: ok, message: ok ? "" : `value ${String(value)} < min ${rule.min}` };
    }
    case "max": {
      const ok = typeof value === "number" && value <= rule.max;
      return { rule: label, passed: ok, message: ok ? "" : `value ${String(value)} > max ${rule.max}` };
    }
    case "enum": {
      const ok = rule.values.includes(value);
      return { rule: label, passed: ok, message: ok ? "" : `${String(value)} not in allowed set` };
    }
    case "matches": {
      const re = rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern);
      const ok = typeof value === "string" && re.test(value);
      return { rule: label, passed: ok, message: ok ? "" : `${String(value)} does not match pattern` };
    }
  }
}

/** Options controlling a verification run. */
export interface VerifyOptions {
  samples?: number;
}

/**
 * Run a set of properties and rules against an output and aggregate the result.
 */
export function verify(
  properties: Property<unknown>[],
  rules: Rule[],
  output: unknown,
  opts: VerifyOptions = {},
): VerificationReport {
  const samples = opts.samples ?? 100;
  const propertyResults = properties.map((p) => runProperty(p, samples));
  const ruleResults: RuleResult[] = rules.map((r) => applyRule(r, output));
  const ok =
    propertyResults.every((p) => p.passed) && ruleResults.every((r) => r.passed);
  return {
    ok,
    summary: ok ? "PASS" : "FAIL",
    properties: propertyResults,
    ruleResults,
  };
}
