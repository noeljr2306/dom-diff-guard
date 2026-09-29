export type AutoFixStrategy = 'fit-font' | 'scroll' | 'truncate' | 'none';

export interface OverflowMetrics {
  target: HTMLElement;
  isOverflowingX: boolean;
  isOverflowingY: boolean;
  overflowXPixels: number;
  overflowYPixels: number;
  boundingClientRect: DOMRect;
  timestamp: number;
  /** Strategy that was applied for this detection ('none' if disabled). */
  fixApplied: AutoFixStrategy;
  /** True if the element still overflows after the fix (always true for scroll/truncate). */
  stillOverflowing: boolean;
}

export interface GuardOptions {
  autoFix?: AutoFixStrategy;
  /** Minimum font size in px for 'fit-font'. Default 10. */
  minFontSize?: number;
  /** Ignore overflow up to this many px, to absorb sub-pixel rounding. Default 1. */
  tolerance?: number;
  /** Delay before checking after a change. 0 (default) batches to the next animation frame. */
  debounceMs?: number;
  /** Also re-check when content inside the element changes. Default true. */
  observeMutations?: boolean;
  onOverflow?: (metrics: OverflowMetrics) => void;
}