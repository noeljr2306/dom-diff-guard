import { useEffect, useRef, useState } from "react";
import type { RefCallback } from "react";
import { DOMDiffGuard } from "../core/guard";
import type { GuardOptions } from "../core/types";

export function useDOMGuard<T extends HTMLElement = HTMLDivElement>(
  options: GuardOptions = {},
): RefCallback<T> {
  const [element, setElement] = useState<T | null>(null);

  // Always holds the newest options, so onOverflow is never stale.
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  const { autoFix, minFontSize, tolerance, debounceMs, observeMutations } =
    options;

  useEffect(() => {
    if (!element) return;

    const guard = new DOMDiffGuard();
    guard.observe(element, {
      autoFix,
      minFontSize,
      tolerance,
      debounceMs,
      observeMutations,
      onOverflow: (metrics) => latest.current.onOverflow?.(metrics),
    });

    // disconnect() also restores any inline styles the guard applied
    return () => guard.disconnect();
  }, [element, autoFix, minFontSize, tolerance, debounceMs, observeMutations]);

  return setElement;
}
