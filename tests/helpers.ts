import { vi } from "vitest";

export class MockResizeObserver {
  static instances: MockResizeObserver[] = [];

  observed = new Set<Element>();
  observe = vi.fn((el: Element) => {
    this.observed.add(el);
  });
  unobserve = vi.fn((el: Element) => {
    this.observed.delete(el);
  });
  disconnect = vi.fn(() => {
    this.observed.clear();
  });

  constructor(private callback: ResizeObserverCallback) {
    MockResizeObserver.instances.push(this);
  }

  /** Simulate the browser reporting a size change for `el`. */
  trigger(el: Element): void {
    this.callback(
      [{ target: el } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
}

export function latestObserver(): MockResizeObserver {
  const list = MockResizeObserver.instances;
  const observer = list[list.length - 1];
  if (!observer) throw new Error("No ResizeObserver was created");
  return observer;
}

/** Fake timers + mock ResizeObserver + rAF that runs on the fake clock. */
export function installEnvironment(): void {
  vi.useFakeTimers();
  MockResizeObserver.instances = [];
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
    setTimeout(() => cb(Date.now()), 16),
  );
  vi.stubGlobal("cancelAnimationFrame", (id: ReturnType<typeof setTimeout>) =>
    clearTimeout(id),
  );
}

export function restoreEnvironment(): void {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
}

/** Advance the fake clock, flushing microtasks (MutationObserver callbacks) too. */
export function flush(ms = 20): Promise<void> {
  return vi.advanceTimersByTimeAsync(ms).then(() => undefined);
}

export interface Geometry {
  scrollWidth: number;
  clientWidth: number;
  scrollHeight: number;
  clientHeight: number;
}

/** jsdom has no layout, so define geometry by hand. Mutate the returned object to "resize". */
export function mockGeometry(
  el: HTMLElement,
  initial: Partial<Geometry> = {},
): Geometry {
  const geometry: Geometry = {
    scrollWidth: 100,
    clientWidth: 100,
    scrollHeight: 100,
    clientHeight: 100,
    ...initial,
  };
  (Object.keys(geometry) as (keyof Geometry)[]).forEach((key) => {
    Object.defineProperty(el, key, {
      configurable: true,
      get: () => geometry[key],
    });
  });
  return geometry;
}

/**
 * A 100px-wide box whose text width scales with its font size, so 'fit-font'
 * has something real to shrink. Text needs `fontSize * textUnit` px.
 */
export function makeTextBox(startFont: number, textUnit = 8): HTMLDivElement {
  const el = document.createElement("div");
  el.style.fontSize = `${startFont}px`;
  document.body.appendChild(el);

  Object.defineProperty(el, "clientWidth", { configurable: true, value: 100 });
  Object.defineProperty(el, "scrollWidth", {
    configurable: true,
    get: () => Math.max(100, parseFloat(el.style.fontSize) * textUnit),
  });
  return el;
}
