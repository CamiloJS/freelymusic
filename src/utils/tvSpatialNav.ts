export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * Finds the index of the best candidate element in the given 2D direction.
 * Uses Euclidean directional distance with perpendicular alignment penalty.
 */
export function findBestSpatialTarget(
  current: Rect,
  candidates: Rect[],
  direction: Direction
): number {
  if (!candidates || candidates.length === 0) return -1;

  const currentCenterX = current.left + current.width / 2;
  const currentCenterY = current.top + current.height / 2;

  let bestIndex = -1;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    // Ignore candidate if it has zero area or matches current exactly
    if (cand.width <= 0 || cand.height <= 0) continue;
    if (
      Math.abs(cand.left - current.left) < 2 &&
      Math.abs(cand.top - current.top) < 2 &&
      Math.abs(cand.width - current.width) < 2 &&
      Math.abs(cand.height - current.height) < 2
    ) {
      continue;
    }

    const candCenterX = cand.left + cand.width / 2;
    const candCenterY = cand.top + cand.height / 2;

    let validDirection = false;
    let primaryDistance = 0;
    let perpendicularDelta = 0;

    switch (direction) {
      case 'right':
        if (candCenterX > currentCenterX + 4) {
          validDirection = true;
          primaryDistance = Math.max(0, cand.left - current.right);
          if (cand.left < current.right) primaryDistance = Math.max(0, candCenterX - currentCenterX);
          perpendicularDelta = Math.abs(candCenterY - currentCenterY);
        }
        break;
      case 'left':
        if (candCenterX < currentCenterX - 4) {
          validDirection = true;
          primaryDistance = Math.max(0, current.left - cand.right);
          if (cand.right > current.left) primaryDistance = Math.max(0, currentCenterX - candCenterX);
          perpendicularDelta = Math.abs(candCenterY - currentCenterY);
        }
        break;
      case 'down':
        if (candCenterY > currentCenterY + 4) {
          validDirection = true;
          primaryDistance = Math.max(0, cand.top - current.bottom);
          if (cand.top < current.bottom) primaryDistance = Math.max(0, candCenterY - currentCenterY);
          perpendicularDelta = Math.abs(candCenterX - currentCenterX);
        }
        break;
      case 'up':
        if (candCenterY < currentCenterY - 4) {
          validDirection = true;
          primaryDistance = Math.max(0, current.top - cand.bottom);
          if (cand.bottom > current.top) primaryDistance = Math.max(0, currentCenterY - candCenterY);
          perpendicularDelta = Math.abs(candCenterX - currentCenterX);
        }
        break;
    }

    if (validDirection) {
      // Score: primary distance + perpendicular penalty
      const score = primaryDistance * 1.0 + perpendicularDelta * 2.0;

      if (score < bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
  }

  return bestIndex;
}
