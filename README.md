# dom-diff-guard

A tiny, zero-dependency runtime guard that detects when content overflows its container and fixes it automatically. Built for dynamic UIs where you can't predict text length: AI-generated content, streamed responses, user data and translations.

## The problem

A card sized for "Hello" breaks when an LLM streams back three paragraphs, or a German translation is twice as long. Static CSS can't anticipate this. `dom-diff-guard` watches your elements, detects overflow as it happens (including while text is streaming in), and applies a fix such as shrinking the font, enabling scroll, or truncating with an ellipsis. It also reports metrics so you can log layout breakage in production.

## Install

```bash
npm install dom-diff-guard
```

## Vanilla JS

```js
import { DOMDiffGuard } from 'dom-diff-guard';

const guard = new DOMDiffGuard({ autoFix: 'fit-font' });
guard.observe(document.querySelector('.ai-card'));

// later
guard.unobserve(el); // stops watching and restores original inline styles
guard.disconnect();  // same, for everything
```

## React

```jsx
import { useDOMGuard } from 'dom-diff-guard/react';

function DynamicCard({ content }) {
  const ref = useDOMGuard({
    autoFix: 'fit-font',
    onOverflow: (metrics) => console.warn('Overflow handled:', metrics),
  });

  return <div ref={ref} className="card">{content}</div>;
}
```

Or use the wrapper component. Guard options are props, and everything else goes to the `div`:

```jsx
import { GuardBoundary } from 'dom-diff-guard/react';

<GuardBoundary autoFix="truncate" className="card">{content}</GuardBoundary>
```

The hook returns a callback ref, so it keeps working when the element mounts conditionally.

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `autoFix` | `'fit-font' \| 'scroll' \| 'truncate' \| 'none'` | `'none'` | Fix to apply on overflow |
| `minFontSize` | `number` | `10` | Smallest font size (px) `fit-font` will use |
| `tolerance` | `number` | `1` | Overflow (px) to ignore, which absorbs sub-pixel rounding |
| `debounceMs` | `number` | `0` | Delay before checking after a change. `0` batches to the next animation frame |
| `observeMutations` | `boolean` | `true` | Also re-check when content inside the element changes |
| `onOverflow` | `(metrics) => void` | none | Called when overflow is detected |

### Fix strategies

- **`fit-font`**: shrinks the font 1px at a time until the content fits or `minFontSize` is reached.
- **`scroll`**: sets `overflow: auto`.
- **`truncate`**: sets `overflow: hidden`, `text-overflow: ellipsis` and `white-space: nowrap` (single-line text only).

Every fix is applied as an inline style and reverted when you `unobserve`, `disconnect` or unmount.

### `OverflowMetrics`

```ts
{
  target: HTMLElement;
  isOverflowingX: boolean;
  isOverflowingY: boolean;
  overflowXPixels: number;   // measured before the fix
  overflowYPixels: number;
  boundingClientRect: DOMRect;
  timestamp: number;
  fixApplied: 'fit-font' | 'scroll' | 'truncate' | 'none';
  stillOverflowing: boolean; // true after the fix (always true for scroll/truncate)
}
```

`onOverflow` fires once per distinct overflow. It won't repeat while the same overflow persists, and it fires again if the overflow changes or resolves and reappears.

### `DOMDiffGuard` API

| Method | Description |
|---|---|
| `observe(el, options?)` | Start watching. Calling it again on the same element replaces its options |
| `unobserve(el)` | Stop watching and restore styles |
| `disconnect()` | Unobserve everything |
| `check(el)` | Run a check synchronously. Returns metrics or `null` |

## How it works

A `ResizeObserver` catches box changes, and a `MutationObserver` catches content changes such as streamed text, since the box itself may not resize. Both schedule a debounced check comparing `scrollWidth`/`clientWidth` and `scrollHeight`/`clientHeight`.

## Limitations

- **The container must be size-constrained.** A plain block element grows to fit its content, so give it a fixed `width`, `height` or `max-height`. Long unbroken text and `nowrap` overflow horizontally even in an unconstrained block.
- **`fit-font` only shrinks.** It doesn't grow back if content gets shorter. Unobserve and re-observe to reset.
- **`truncate` only makes sense for single-line text.**
- **Browser-only.** On the server, `observe` is a safe no-op. It requires `ResizeObserver`.

## Next.js / Server Components

The `dom-diff-guard/react` bundle includes the `'use client'` directive, so you can import it from client components directly. Don't call the hook inside a Server Component.

## License

MIT