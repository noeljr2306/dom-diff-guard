import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOMDiffGuard } from "../src/core/guard";
import type { GuardOptions, OverflowMetrics } from "../src/core/types";
import {
  MockResizeObserver,
  flush,
  installEnvironment,
  latestObserver,
  makeTextBox,
  mockGeometry,
  restoreEnvironment,
} from "./helpers";

let guard: DOMDiffGuard | undefined;
let el: HTMLDivElement;

function createGuard(options?: GuardOptions): DOMDiffGuard {
  guard = new DOMDiffGuard(options);
  return guard;
}

const spyFn = () => vi.fn<(m: OverflowMetrics) => void>();

beforeEach(() => {
  installEnvironment();
  el = document.createElement("div");
  document.body.appendChild(el);
});

afterEach(() => {
  guard?.disconnect();
  guard = undefined;
  restoreEnvironment();
});

describe("observation", () => {
  it("registers the element with ResizeObserver", () => {
    createGuard().observe(el);
    expect(latestObserver().observe).toHaveBeenCalledWith(el);
  });

  it("runs an initial check on observe", async () => {
    mockGeometry(el, { scrollWidth: 150 });
    const onOverflow = spyFn();
    createGuard().observe(el, { onOverflow });
    await flush();
    expect(onOverflow).toHaveBeenCalledTimes(1);
  });

  it("does nothing when ResizeObserver is unavailable", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    expect(() => createGuard().observe(el)).not.toThrow();
    expect(MockResizeObserver.instances).toHaveLength(0);
  });
});

describe("overflow detection", () => {
  it("reports nothing when the content fits", async () => {
    mockGeometry(el);
    const onOverflow = spyFn();
    createGuard().observe(el, { onOverflow });
    await flush();
    expect(onOverflow).not.toHaveBeenCalled();
  });

  it("reports horizontal overflow with metrics", async () => {
    mockGeometry(el, { scrollWidth: 150, clientWidth: 100 });
    const onOverflow = spyFn();
    createGuard().observe(el, { onOverflow });
    await flush();
    expect(onOverflow).toHaveBeenCalledWith(
      expect.objectContaining({
        target: el,
        isOverflowingX: true,
        isOverflowingY: false,
        overflowXPixels: 50,
        overflowYPixels: 0,
        fixApplied: "none",
        stillOverflowing: true,
      }),
    );
  });

  it("reports vertical overflow", async () => {
    mockGeometry(el, { scrollHeight: 140, clientHeight: 100 });
    const onOverflow = spyFn();
    createGuard().observe(el, { onOverflow });
    await flush();
    expect(onOverflow).toHaveBeenCalledWith(
      expect.objectContaining({ isOverflowingY: true, overflowYPixels: 40 }),
    );
  });

  it("ignores 1px sub-pixel overflow by default", async () => {
    mockGeometry(el, { scrollWidth: 101 });
    const onOverflow = spyFn();
    createGuard().observe(el, { onOverflow });
    await flush();
    expect(onOverflow).not.toHaveBeenCalled();
  });

  it("honours a custom tolerance", async () => {
    const geometry = mockGeometry(el, { scrollWidth: 108 });
    const onOverflow = spyFn();
    createGuard().observe(el, { tolerance: 10, onOverflow });
    await flush();
    expect(onOverflow).not.toHaveBeenCalled();

    geometry.scrollWidth = 112;
    latestObserver().trigger(el);
    await flush();
    expect(onOverflow).toHaveBeenCalledTimes(1);
  });
});

describe("auto-fix strategies", () => {
  it("'scroll' applies overflow: auto and reports stillOverflowing", async () => {
    mockGeometry(el, { scrollWidth: 150 });
    const onOverflow = spyFn();
    createGuard().observe(el, { autoFix: "scroll", onOverflow });
    await flush();
    expect(el.style.overflow).toBe("auto");
    expect(onOverflow).toHaveBeenCalledWith(
      expect.objectContaining({ fixApplied: "scroll", stillOverflowing: true }),
    );
  });

  it("'truncate' applies the ellipsis styles", async () => {
    mockGeometry(el, { scrollWidth: 150 });
    const onOverflow = spyFn();
    createGuard().observe(el, { autoFix: "truncate", onOverflow });
    await flush();
    expect(el.style.getPropertyValue("text-overflow")).toBe("ellipsis");
    expect(onOverflow).toHaveBeenCalledWith(
      expect.objectContaining({ fixApplied: "truncate" }),
    );
  });

  it("'fit-font' shrinks the text and reports the pre-fix overflow", async () => {
    const box = makeTextBox(20);
    const onOverflow = spyFn();
    createGuard().observe(box, { autoFix: "fit-font", onOverflow });
    await flush();
    expect(box.style.fontSize).toBe("12px");
    expect(onOverflow).toHaveBeenCalledWith(
      expect.objectContaining({
        fixApplied: "fit-font",
        overflowXPixels: 60,
        stillOverflowing: false,
      }),
    );
  });

  it("merges global options with per-element options", async () => {
    const other = document.createElement("div");
    mockGeometry(el, { scrollWidth: 150 });
    mockGeometry(other, { scrollWidth: 150 });

    const g = createGuard({ autoFix: "scroll" });
    g.observe(el, { autoFix: "none" });
    g.observe(other);
    await flush();

    expect(el.style.overflow).toBe("");
    expect(other.style.overflow).toBe("auto");
  });
});

describe("restoring", () => {
  it("restores original inline styles on unobserve", async () => {
    el.style.overflow = "visible";
    mockGeometry(el, { scrollWidth: 150 });
    const g = createGuard();
    g.observe(el, { autoFix: "scroll" });
    await flush();
    expect(el.style.overflow).toBe("auto");

    g.unobserve(el);
    expect(el.style.overflow).toBe("visible");
  });

  it("undoes the old fix when re-observed with new options", async () => {
    mockGeometry(el, { scrollWidth: 150 });
    const g = createGuard();
    g.observe(el, { autoFix: "scroll" });
    await flush();
    expect(el.style.overflow).toBe("auto");

    g.observe(el, { autoFix: "none" });
    await flush();
    expect(el.style.overflow).toBe("");
  });
});

describe("re-checking", () => {
  it("re-checks when ResizeObserver fires", async () => {
    const geometry = mockGeometry(el);
    const onOverflow = spyFn();
    createGuard().observe(el, { onOverflow });
    await flush();
    expect(onOverflow).not.toHaveBeenCalled();

    geometry.scrollWidth = 160;
    latestObserver().trigger(el);
    await flush();
    expect(onOverflow).toHaveBeenCalledTimes(1);
  });

  it("re-checks when content changes (streaming text)", async () => {
    const geometry = mockGeometry(el);
    const onOverflow = spyFn();
    createGuard().observe(el, { onOverflow });
    await flush();
    expect(onOverflow).not.toHaveBeenCalled();

    geometry.scrollWidth = 160;
    el.append(document.createTextNode("more streamed text"));
    await flush();
    expect(onOverflow).toHaveBeenCalledTimes(1);
  });

  it("ignores content changes when observeMutations is false", async () => {
    const geometry = mockGeometry(el);
    const onOverflow = spyFn();
    createGuard().observe(el, { onOverflow, observeMutations: false });
    await flush();

    geometry.scrollWidth = 160;
    el.append(document.createTextNode("more text"));
    await flush();
    expect(onOverflow).not.toHaveBeenCalled();
  });

  it("debounces rapid changes into a single check", async () => {
    mockGeometry(el);
    const g = createGuard({ debounceMs: 100 });
    const check = vi.spyOn(g, "check");
    g.observe(el);

    await flush(60);
    latestObserver().trigger(el); // pushes the check back to t = 160
    await flush(60); // t = 120
    expect(check).not.toHaveBeenCalled();

    await flush(60); // t = 180
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("does not repeat onOverflow for the same overflow", async () => {
    const geometry = mockGeometry(el, { scrollWidth: 150 });
    const onOverflow = spyFn();
    createGuard().observe(el, { onOverflow });
    await flush();
    expect(onOverflow).toHaveBeenCalledTimes(1);

    latestObserver().trigger(el); // same overflow, so no repeat
    await flush();
    expect(onOverflow).toHaveBeenCalledTimes(1);

    geometry.scrollWidth = 170; // different overflow, so it reports
    latestObserver().trigger(el);
    await flush();
    expect(onOverflow).toHaveBeenCalledTimes(2);

    geometry.scrollWidth = 100; // resolved
    latestObserver().trigger(el);
    await flush();
    geometry.scrollWidth = 170; // overflows again, so it reports again
    latestObserver().trigger(el);
    await flush();
    expect(onOverflow).toHaveBeenCalledTimes(3);
  });

  it("survives a throwing onOverflow callback", async () => {
    mockGeometry(el, { scrollWidth: 150 });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    createGuard().observe(el, {
      onOverflow: () => {
        throw new Error("boom");
      },
    });
    await flush();
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("onOverflow threw"),
      expect.any(Error),
    );
  });
});

describe("manual check()", () => {
  it("returns metrics synchronously for an observed element", () => {
    mockGeometry(el, { scrollWidth: 150 });
    const g = createGuard();
    g.observe(el);
    expect(g.check(el)).toEqual(
      expect.objectContaining({ overflowXPixels: 50 }),
    );
  });

  it("returns null for an element that is not observed", () => {
    mockGeometry(el, { scrollWidth: 150 });
    expect(createGuard().check(el)).toBeNull();
  });
});

describe("teardown", () => {
  it("unobserve stops checks, including pending ones", async () => {
    const geometry = mockGeometry(el, { scrollWidth: 150 });
    const onOverflow = spyFn();
    const g = createGuard();
    g.observe(el, { onOverflow });
    g.unobserve(el); // cancels the pending initial check
    await flush();
    expect(onOverflow).not.toHaveBeenCalled();
    expect(latestObserver().unobserve).toHaveBeenCalledWith(el);

    geometry.scrollWidth = 200;
    latestObserver().trigger(el);
    await flush();
    expect(onOverflow).not.toHaveBeenCalled();
  });

  it("disconnect releases everything and restores styles", async () => {
    const other = document.createElement("div");
    mockGeometry(el, { scrollWidth: 150 });
    mockGeometry(other, { scrollWidth: 150 });

    const g = createGuard({ autoFix: "scroll" });
    g.observe(el);
    g.observe(other);
    await flush();
    expect(el.style.overflow).toBe("auto");

    const observer = latestObserver();
    g.disconnect();
    expect(observer.disconnect).toHaveBeenCalled();
    expect(el.style.overflow).toBe("");
    expect(other.style.overflow).toBe("");
  });
});
