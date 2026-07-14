import { describe, it, expect } from 'vitest';
import { classifyHarassmentSignal, HARASSMENT_WATCH_THRESHOLD } from './harassmentWatch.js';

describe('classifyHarassmentSignal', () => {
  it('is false below the threshold', () => {
    expect(classifyHarassmentSignal(HARASSMENT_WATCH_THRESHOLD - 1)).toBe(false);
  });

  it('is true at the threshold', () => {
    expect(classifyHarassmentSignal(HARASSMENT_WATCH_THRESHOLD)).toBe(true);
  });

  it('is true above the threshold', () => {
    expect(classifyHarassmentSignal(HARASSMENT_WATCH_THRESHOLD + 5)).toBe(true);
  });

  it('is false for zero', () => {
    expect(classifyHarassmentSignal(0)).toBe(false);
  });
});
