import { describe, it, expect } from 'vitest';
import { sortReviewItems } from './agentReview.js';

describe('sortReviewItems', () => {
  it('puts recommended_approve items before needs_review items', () => {
    const items = [
      { id: 'a', queue_bucket: 'needs_review', category: 'x' },
      { id: 'b', queue_bucket: 'recommended_approve', category: 'x' },
    ];
    expect(sortReviewItems(items as never).map(i => i.id)).toEqual(['b', 'a']);
  });

  it('is stable for items already in the same bucket', () => {
    const items = [
      { id: 'a', queue_bucket: 'needs_review', category: 'x' },
      { id: 'b', queue_bucket: 'needs_review', category: 'y' },
    ];
    expect(sortReviewItems(items as never).map(i => i.id)).toEqual(['a', 'b']);
  });
});
