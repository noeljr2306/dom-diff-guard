import { isOverflowing, measureOverflow } from "./measure";
import type { AutoFixStrategy, GuardOptions } from "./types";

interface SavedStyle {
  value: string;
  priority: string;
}

// Original inline styles, saved the first time we touch a property.
const saved = new WeakMap<HTMLElement, Map<string, SavedStyle>>();

function setStyle(el: HTMLElement, prop: string, value: string): void {
  let props = saved.get(el);
  if (!props) {
    props = new Map();
    saved.set(el, props);
  }
  if (!props.has(prop)) {
    props.set(prop, {
      value: el.style.getPropertyValue(prop),
      priority: el.style.getPropertyPriority(prop),
    });
  }
  el.style.setProperty(prop, value);
}

export function restoreRemediation(el: HTMLElement): void {
  const props = saved.get(el);
  if (!props) return;
  props.forEach(({ value, priority }, prop) => {
    if (value) el.style.setProperty(prop, value, priority);
    else el.style.removeProperty(prop);
  });
  saved.delete(el);
}

export function applyRemediation(
  el: HTMLElement,
  strategy: AutoFixStrategy,
  options: GuardOptions,
): void {
  switch (strategy) {
    case "scroll":
      setStyle(el, "overflow", "auto");
      break;

    case "truncate":
      // Note: ellipsis only works for single-line text.
      setStyle(el, "overflow", "hidden");
      setStyle(el, "text-overflow", "ellipsis");
      setStyle(el, "white-space", "nowrap");
      break;

    case "fit-font": {
      const min = options.minFontSize ?? 10;
      const tolerance = options.tolerance ?? 1;
      let size = parseFloat(window.getComputedStyle(el).fontSize);
      if (!Number.isFinite(size)) break;

      // Shrink 1px at a time until it fits or we hit the floor.
      for (let i = 0; i < 100 && size > min; i++) {
        if (!isOverflowing(measureOverflow(el, tolerance))) break;
        size = Math.max(min, size - 1);
        setStyle(el, "font-size", `${size}px`);
      }
      break;
    }

    case "none":
      break;
  }
}
