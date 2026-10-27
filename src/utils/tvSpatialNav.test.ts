import { describe, it, expect } from 'vitest';
import { findBestSpatialTarget, Rect } from './tvSpatialNav';

describe('tvSpatialNav', () => {
  it('navigates right and left in a horizontal row', () => {
    const cardA: Rect = { left: 0, top: 0, right: 100, bottom: 50, width: 100, height: 50 };
    const cardB: Rect = { left: 120, top: 0, right: 220, bottom: 50, width: 100, height: 50 };
    const cardC: Rect = { left: 240, top: 0, right: 340, bottom: 50, width: 100, height: 50 };

    const candidates = [cardA, cardB, cardC];

    // From A, moving right should go to B (index 1)
    const nextRight = findBestSpatialTarget(cardA, candidates, 'right');
    expect(nextRight).toBe(1);

    // From B, moving right should go to C (index 2)
    const nextRightFromB = findBestSpatialTarget(cardB, candidates, 'right');
    expect(nextRightFromB).toBe(2);

    // From C, moving left should go to B (index 1)
    const nextLeftFromC = findBestSpatialTarget(cardC, candidates, 'left');
    expect(nextLeftFromC).toBe(1);

    // From A, moving left has nothing -> returns -1
    expect(findBestSpatialTarget(cardA, candidates, 'left')).toBe(-1);
  });

  it('navigates up and down in a grid', () => {
    // Row 1
    const r1c1: Rect = { left: 0, top: 0, right: 100, bottom: 50, width: 100, height: 50 };
    const r1c2: Rect = { left: 120, top: 0, right: 220, bottom: 50, width: 100, height: 50 };
    // Row 2
    const r2c1: Rect = { left: 0, top: 70, right: 100, bottom: 120, width: 100, height: 50 };
    const r2c2: Rect = { left: 120, top: 70, right: 220, bottom: 120, width: 100, height: 50 };

    const candidates = [r1c1, r1c2, r2c1, r2c2];

    // From r1c1, moving down should go to r2c1 (index 2)
    expect(findBestSpatialTarget(r1c1, candidates, 'down')).toBe(2);

    // From r2c2, moving up should go to r1c2 (index 1)
    expect(findBestSpatialTarget(r2c2, candidates, 'up')).toBe(1);

    // From r1c1, moving right should go to r1c2 (index 1)
    expect(findBestSpatialTarget(r1c1, candidates, 'right')).toBe(1);
  });

  it('handles empty candidates or no valid target gracefully', () => {
    const single: Rect = { left: 0, top: 0, right: 100, bottom: 50, width: 100, height: 50 };
    expect(findBestSpatialTarget(single, [], 'down')).toBe(-1);
    expect(findBestSpatialTarget(single, [single], 'down')).toBe(-1);
  });
});
