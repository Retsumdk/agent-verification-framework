/**
 * agent-verification-framework — shared types.
 * Built by Retsumdk
 */

/** A property-based test: generate a value and check an invariant over it. */
export interface Property<T> {
  name: string;
  generate: () => T;
  check: (value: T) => boolean;
}

/** Result of running a single property across many samples. */
export interface PropertyResult {
  name: string;
  passed: boolean;
  runs: number;
  failures: number;
  counterexample?: unknown;
}

/** A runtime rule applied to an agent output at a dotted path. */
export type Rule =
  | { kind: "type"; path: string; type: "string" | "number" | "boolean" | "object" }
  | { kind: "min"; path: string; min: number }
  | { kind: "max"; path: string; max: number }
  | { kind: "enum"; path: string; values: unknown[] }
  | { kind: "matches"; path: string; pattern: string | RegExp };

/** Result of applying a single rule to an output. */
export interface RuleResult {
  rule: string;
  passed: boolean;
  message: string;
}

/** Aggregated result of a full verification run. */
export interface VerificationReport {
  ok: boolean;
  summary: "PASS" | "FAIL";
  properties: PropertyResult[];
  ruleResults: RuleResult[];
}
