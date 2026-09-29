import { afterEach, describe, expect, it } from "vitest";
import { applyRemediation, restoreRemediation } from "../src/core/remediation";
import { makeTextBox } from "./helpers";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("scroll and truncate", () => {
  it("'scroll' sets overflow: auto", () => {
    const el = document.createElement("div");
    applyRemediation(el, "scroll", {});
    expect(el.style.overflow).toBe("auto");
  });

  it("'truncate' sets the ellipsis trio", () => {
    const el = document.createElement("div");
    applyRemediation(el, "truncate", {});
    expect(el.style.getPropertyValue("overflow")).toBe("hidden");
    expect(el.style.getPropertyValue("text-overflow")).toBe("ellipsis");
    expect(el.style.getPropertyValue("white-space")).toBe("nowrap");
  });

  it("'none' leaves the element alone", () => {
    const el = document.createElement("div");
    applyRemediation(el, "none", {});
    expect(el.style.cssText).toBe("");
  });
});

describe("fit-font", () => {
  it("shrinks until the text fits", () => {
    const el = makeTextBox(20); // needs fontSize * 8 <= 100, so 12px
    applyRemediation(el, "fit-font", {});
    expect(el.style.fontSize).toBe("12px");
  });

  it("never goes below minFontSize", () => {
    const el = makeTextBox(16, 50); // can never fit
    applyRemediation(el, "fit-font", { minFontSize: 12 });
    expect(el.style.fontSize).toBe("12px");
  });

  it("defaults the floor to 10px", () => {
    const el = makeTextBox(14, 50);
    applyRemediation(el, "fit-font", {});
    expect(el.style.fontSize).toBe("10px");
  });

  it("does nothing when the text already fits", () => {
    const el = makeTextBox(12);
    applyRemediation(el, "fit-font", {});
    expect(el.style.fontSize).toBe("12px");
  });

  it("respects the tolerance option", () => {
    const el = makeTextBox(13); // overflows by 4px
    applyRemediation(el, "fit-font", { tolerance: 5 });
    expect(el.style.fontSize).toBe("13px");
  });
});

describe("restoreRemediation", () => {
  it("puts back the original inline value", () => {
    const el = makeTextBox(20);
    applyRemediation(el, "fit-font", {});
    restoreRemediation(el);
    expect(el.style.fontSize).toBe("20px");
  });

  it("removes properties that were not set originally", () => {
    const el = document.createElement("div");
    applyRemediation(el, "truncate", {});
    restoreRemediation(el);
    expect(el.style.getPropertyValue("text-overflow")).toBe("");
    expect(el.style.cssText).toBe("");
  });

  it("keeps the first original value across repeated fixes", () => {
    const el = document.createElement("div");
    el.style.overflow = "visible";
    applyRemediation(el, "scroll", {});
    applyRemediation(el, "truncate", {});
    restoreRemediation(el);
    expect(el.style.overflow).toBe("visible");
  });

  it("is a no-op on an element that was never touched", () => {
    const el = document.createElement("div");
    el.style.color = "red";
    expect(() => restoreRemediation(el)).not.toThrow();
    expect(el.style.color).toBe("red");
  });
});
