import { isOverflowing, measureOverflow } from "./measure";
import { applyRemediation, restoreRemediation } from "./remediation";
import type { GuardOptions, OverflowMetrics } from "./types";

interface Entry {
  options: GuardOptions;
  mutationObserver: MutationObserver | null;
  /** Key of the last reported overflow, used to avoid repeat callbacks. */
  lastReport: string | null;
}

export class DOMDiffGuard {
  private resizeObserver: ResizeObserver | null = null;
  private entries = new Map<HTMLElement, Entry>();
  private pending = new Map<HTMLElement, () => void>();

  constructor(private readonly globalOptions: GuardOptions = {}) {}

  public observe(element: HTMLElement, localOptions: GuardOptions = {}): void {
    // No-op on the server or in unsupported environments.
    if (typeof ResizeObserver === "undefined") return;

    const options = { ...this.globalOptions, ...localOptions };
    const existing = this.entries.get(element);

    if (existing) {
      // Options changed: undo old fixes, then re-evaluate from scratch.
      restoreRemediation(element);
      existing.options = options;
      existing.lastReport = null;
      this.schedule(element);
      return;
    }

    const entry: Entry = { options, mutationObserver: null, lastReport: null };

    if (
      options.observeMutations !== false &&
      typeof MutationObserver !== "undefined"
    ) {
      entry.mutationObserver = new MutationObserver(() =>
        this.schedule(element),
      );
      entry.mutationObserver.observe(element, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    this.entries.set(element, entry);
    this.getResizeObserver().observe(element);
    this.schedule(element);
  }

  public unobserve(element: HTMLElement): void {
    const entry = this.entries.get(element);
    if (!entry) return;

    this.cancel(element);
    entry.mutationObserver?.disconnect();
    this.resizeObserver?.unobserve(element);
    restoreRemediation(element);
    this.entries.delete(element);
  }

  public disconnect(): void {
    for (const element of Array.from(this.entries.keys())) {
      this.unobserve(element);
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  /** Run a check immediately (synchronously). Returns metrics if overflow was found. */
  public check(el: HTMLElement): OverflowMetrics | null {
    const entry = this.entries.get(el);
    if (!entry) return null;

    const { options } = entry;
    const tolerance = options.tolerance ?? 1;
    const before = measureOverflow(el, tolerance);

    if (!isOverflowing(before)) {
      entry.lastReport = null;
      return null;
    }

    const strategy = options.autoFix ?? "none";
    if (strategy !== "none") {
      applyRemediation(el, strategy, options);
    }
    const after = measureOverflow(el, tolerance);

    const metrics: OverflowMetrics = {
      target: el,
      isOverflowingX: before.x > 0,
      isOverflowingY: before.y > 0,
      overflowXPixels: before.x,
      overflowYPixels: before.y,
      boundingClientRect: el.getBoundingClientRect(),
      timestamp: Date.now(),
      fixApplied: strategy,
      stillOverflowing: isOverflowing(after),
    };

    const key = `${before.x}:${before.y}:${strategy}`;
    if (key !== entry.lastReport) {
      entry.lastReport = key;
      try {
        options.onOverflow?.(metrics);
      } catch (err) {
        console.error("[dom-diff-guard] onOverflow threw:", err);
      }
    }

    return metrics;
  }

  private getResizeObserver(): ResizeObserver {
    if (!this.resizeObserver) {
      this.resizeObserver = new ResizeObserver((records) => {
        for (const record of records) {
          this.schedule(record.target as HTMLElement);
        }
      });
    }
    return this.resizeObserver;
  }

  private schedule(el: HTMLElement): void {
    const entry = this.entries.get(el);
    if (!entry) return;

    this.cancel(el);

    const run = () => {
      this.pending.delete(el);
      this.check(el);
    };

    const delay = entry.options.debounceMs ?? 0;
    if (delay > 0) {
      const id = setTimeout(run, delay);
      this.pending.set(el, () => clearTimeout(id));
    } else if (typeof requestAnimationFrame === "function") {
      const id = requestAnimationFrame(run);
      this.pending.set(el, () => cancelAnimationFrame(id));
    } else {
      const id = setTimeout(run, 16);
      this.pending.set(el, () => clearTimeout(id));
    }
  }

  private cancel(el: HTMLElement): void {
    this.pending.get(el)?.();
    this.pending.delete(el);
  }
}
