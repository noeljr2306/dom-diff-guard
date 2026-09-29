import { describe, expect, it } from "vitest";
import { isOverflowing, measureOverflow } from "../src/core/measure";

const fake = (g: Record<string, number>) => g as unknown as HTMLElement;

describe("measureOverflow", () => {
  it("returns the overflow in pixels per axis", () => {
    const o = measureOverflow(
      fake({
        scrollWidth: 150,
        clientWidth: 100,
        scrollHeight: 130,
        clientHeight: 100,
      }),
    );
    expect(o).toEqual({ x: 50, y: 30 });
  });

  it("returns 0 when content fits", () => {
    const o = measureOverflow(
      fake({
        scrollWidth: 100,
        clientWidth: 100,
        scrollHeight: 90,
        clientHeight: 100,
      }),
    );
    expect(o).toEqual({ x: 0, y: 0 });
  });

  it("ignores overflow within the tolerance", () => {
    const el = fake({
      scrollWidth: 101,
      clientWidth: 100,
      scrollHeight: 100,
      clientHeight: 100,
    });
    expect(measureOverflow(el)).toEqual({ x: 0, y: 0 });
    expect(measureOverflow(el, 0)).toEqual({ x: 1, y: 0 });
  });

  it("isOverflowing is true if either axis overflows", () => {
    expect(isOverflowing({ x: 0, y: 0 })).toBe(false);
    expect(isOverflowing({ x: 5, y: 0 })).toBe(true);
    expect(isOverflowing({ x: 0, y: 5 })).toBe(true);
  });
});
