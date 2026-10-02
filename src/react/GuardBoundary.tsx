import type { HTMLAttributes } from "react";
import type { GuardOptions } from "../core/types";
import { useDOMGuard } from "./useDOMGuard";

export interface GuardBoundaryProps
  extends GuardOptions, HTMLAttributes<HTMLDivElement> {}

export function GuardBoundary({
  autoFix,
  minFontSize,
  tolerance,
  debounceMs,
  observeMutations,
  onOverflow,
  children,
  ...divProps
}: GuardBoundaryProps) {
  const ref = useDOMGuard<HTMLDivElement>({
    autoFix,
    minFontSize,
    tolerance,
    debounceMs,
    observeMutations,
    onOverflow,
  });

  return (
    <div ref={ref} {...divProps}>
      {children}
    </div>
  );
}
