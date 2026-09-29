export interface Overflow {
  x: number;
  y: number;
}

export function measureOverflow(el: HTMLElement, tolerance = 1): Overflow {
  const x = el.scrollWidth - el.clientWidth;
  const y = el.scrollHeight - el.clientHeight;
  return {
    x: x > tolerance ? x : 0,
    y: y > tolerance ? y : 0,
  };
}

export function isOverflowing(o: Overflow): boolean {
  return o.x > 0 || o.y > 0;
}
