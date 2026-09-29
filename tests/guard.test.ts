import { describe, it, expect } from 'vitest';

describe('toolchain', () => {
  it('runs in a jsdom environment', () => {
    expect(typeof document).toBe('object');
  });
});