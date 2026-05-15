import { describe, expect, test } from "vitest";
import { computeStructuralFingerprint } from "./structuralFingerprint";

describe("computeStructuralFingerprint", () => {
  test("empty model is stable", () => {
    const a = computeStructuralFingerprint([], [], new Map(), new Map(), undefined);
    const b = computeStructuralFingerprint([], [], new Map(), new Map(), undefined);
    expect(a).toBe(b);
    expect(a.startsWith("v2:")).toBe(true);
  });

  test("coordinate change changes fingerprint", () => {
    const nodes0 = [
      [0, 0, 0],
      [1, 0, 0],
    ];
    const nodes1 = [
      [0, 0, 0],
      [1, 0, 1e-9],
    ];
    const elements = [[0, 1]];
    const supports = new Map<
      number,
      [boolean, boolean, boolean, boolean, boolean, boolean]
    >();
    const elementsProps = new Map();
    const fp0 = computeStructuralFingerprint(
      nodes0,
      elements,
      supports,
      elementsProps,
      undefined,
    );
    const fp1 = computeStructuralFingerprint(
      nodes1,
      elements,
      supports,
      elementsProps,
      undefined,
    );
    expect(fp0).not.toBe(fp1);
  });

  test("support change changes fingerprint", () => {
    const nodes = [
      [0, 0, 0],
      [1, 0, 0],
    ];
    const elements = [[0, 1]];
    const s0 = new Map<
      number,
      [boolean, boolean, boolean, boolean, boolean, boolean]
    >();
    const s1 = new Map<number, [boolean, boolean, boolean, boolean, boolean, boolean]>([
      [0, [true, true, true, false, false, false]],
    ]);
    const props = new Map();
    const fp0 = computeStructuralFingerprint(nodes, elements, s0, props, undefined);
    const fp1 = computeStructuralFingerprint(nodes, elements, s1, props, undefined);
    expect(fp0).not.toBe(fp1);
  });
});
