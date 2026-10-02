import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { GuardBoundary, useDOMGuard } from "../src/react";
import type { GuardOptions, OverflowMetrics } from "../src/react";
import {
  flush,
  installEnvironment,
  latestObserver,
  restoreEnvironment,
} from "./helpers";

const spyFn = () => vi.fn<(m: OverflowMetrics) => void>();

function Probe({
  show = true,
  options,
}: {
  show?: boolean;
  options: GuardOptions;
}) {
  const ref = useDOMGuard<HTMLDivElement>(options);
  return show ? (
    <div ref={ref} data-testid="box" data-scroll-width="150" />
  ) : null;
}

const attr = (el: HTMLElement) =>
  Number(el.getAttribute("data-scroll-width") ?? 100);

beforeEach(() => {
  installEnvironment();
  const define = (name: string, get: (el: HTMLElement) => number) =>
    Object.defineProperty(HTMLElement.prototype, name, {
      configurable: true,
      get(this: HTMLElement) {
        return get(this);
      },
    });
  define("scrollWidth", attr);
  define("clientWidth", () => 100);
  define("scrollHeight", () => 100);
  define("clientHeight", () => 100);
});

afterEach(() => {
  cleanup();
  for (const name of [
    "scrollWidth",
    "clientWidth",
    "scrollHeight",
    "clientHeight",
  ]) {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name];
  }
  restoreEnvironment();
});

describe("useDOMGuard", () => {
  it("observes the element and reports overflow", async () => {
    const onOverflow = spyFn();
    const { getByTestId } = render(<Probe options={{ onOverflow }} />);
    await flush();

    expect(latestObserver().observe).toHaveBeenCalledWith(getByTestId("box"));
    expect(onOverflow).toHaveBeenCalledTimes(1);
    expect(onOverflow).toHaveBeenCalledWith(
      expect.objectContaining({ overflowXPixels: 50, isOverflowingX: true }),
    );
  });

  it("stops observing and restores styles on unmount", async () => {
    const { getByTestId, unmount } = render(
      <Probe options={{ autoFix: "scroll" }} />,
    );
    await flush();

    const node = getByTestId("box");
    expect(node.style.overflow).toBe("auto");

    unmount();
    expect(latestObserver().disconnect).toHaveBeenCalled();
    expect(node.style.overflow).toBe("");
  });

  it("always calls the latest onOverflow (no stale closure)", async () => {
    const first = spyFn();
    const second = spyFn();
    const { getByTestId, rerender } = render(
      <Probe options={{ onOverflow: first }} />,
    );
    await flush();
    expect(first).toHaveBeenCalledTimes(1);

    rerender(<Probe options={{ onOverflow: second }} />);
    const node = getByTestId("box");
    node.setAttribute("data-scroll-width", "170"); // a different overflow, so it reports
    latestObserver().trigger(node);
    await flush();

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
  });

  it("applies new options when they change", async () => {
    const { getByTestId, rerender } = render(
      <Probe options={{ autoFix: "none" }} />,
    );
    await flush();
    const node = getByTestId("box");
    expect(node.style.overflow).toBe("");

    rerender(<Probe options={{ autoFix: "scroll" }} />);
    await flush();
    expect(node.style.overflow).toBe("auto");

    rerender(<Probe options={{ autoFix: "none" }} />);
    await flush();
    expect(node.style.overflow).toBe("");
  });

  it("follows conditionally rendered elements", async () => {
    const onOverflow = spyFn();
    const { rerender } = render(<Probe show options={{ onOverflow }} />);
    await flush();
    expect(onOverflow).toHaveBeenCalledTimes(1);

    rerender(<Probe show={false} options={{ onOverflow }} />);
    rerender(<Probe show options={{ onOverflow }} />);
    await flush();
    expect(onOverflow).toHaveBeenCalledTimes(2);
  });

  it("gives each hook instance its own guard", async () => {
    const a = spyFn();
    const b = spyFn();
    render(
      <>
        <Probe options={{ onOverflow: a }} />
        <Probe options={{ onOverflow: b }} />
      </>,
    );
    await flush();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});

describe("GuardBoundary", () => {
  it("renders children and passes div props through", () => {
    const { getByTestId } = render(
      <GuardBoundary data-testid="gb" className="card" autoFix="scroll">
        hello
      </GuardBoundary>,
    );
    const node = getByTestId("gb");
    expect(node.textContent).toBe("hello");
    expect(node.className).toBe("card");
  });

  it("does not leak guard options onto the DOM", () => {
    const { getByTestId } = render(
      <GuardBoundary
        data-testid="gb"
        autoFix="fit-font"
        minFontSize={12}
        debounceMs={50}
      />,
    );
    const node = getByTestId("gb");
    expect(node.getAttribute("autofix")).toBeNull();
    expect(node.getAttribute("minfontsize")).toBeNull();
    expect(node.getAttribute("debouncems")).toBeNull();
  });

  it("applies the fix and reports overflow", async () => {
    const onOverflow = spyFn();
    const { getByTestId } = render(
      <GuardBoundary
        data-testid="gb"
        data-scroll-width="150"
        autoFix="scroll"
        onOverflow={onOverflow}
      />,
    );
    await flush();
    expect(getByTestId("gb").style.overflow).toBe("auto");
    expect(onOverflow).toHaveBeenCalledWith(
      expect.objectContaining({ fixApplied: "scroll" }),
    );
  });
});
