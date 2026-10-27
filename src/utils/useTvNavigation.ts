import { useEffect, useCallback } from 'react';
import { findBestSpatialTarget, Direction, Rect } from './tvSpatialNav';

export interface TvNavigationOptions {
  containerRef?: React.RefObject<HTMLElement | null>;
  onBack?: () => void;
  onPlayPause?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onFastForward?: () => void;
  onRewind?: () => void;
  enabled?: boolean;
}

export function useTvNavigation(options: TvNavigationOptions = {}) {
  const {
    containerRef,
    onBack,
    onPlayPause,
    onNext,
    onPrev,
    onFastForward,
    onRewind,
    enabled = true,
  } = options;

  const getFocusableElements = useCallback((): HTMLElement[] => {
    const root = containerRef?.current || document;
    const elements = Array.from(
      root.querySelectorAll<HTMLElement>(
        '[data-tv-focus="true"], button:not([disabled]):not([tabindex="-1"]), [tabindex="0"]'
      )
    );

    return elements.filter((el) => {
      // Must be visible and have size
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0'
      );
    });
  }, [containerRef]);

  const moveFocus = useCallback(
    (direction: Direction) => {
      const candidates = getFocusableElements();
      if (candidates.length === 0) return;

      const activeEl = document.activeElement as HTMLElement | null;
      let currentRect: Rect;

      if (
        activeEl &&
        candidates.includes(activeEl) &&
        activeEl.getBoundingClientRect().width > 0
      ) {
        const domRect = activeEl.getBoundingClientRect();
        currentRect = {
          left: domRect.left,
          top: domRect.top,
          right: domRect.right,
          bottom: domRect.bottom,
          width: domRect.width,
          height: domRect.height,
        };
      } else {
        // Fallback: pick first element or one in center
        const first = candidates[0];
        first.focus();
        first.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        return;
      }

      const candidateRects: Rect[] = candidates.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          left: r.left,
          top: r.top,
          right: r.right,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
        };
      });

      const bestIndex = findBestSpatialTarget(currentRect, candidateRects, direction);
      if (bestIndex >= 0 && bestIndex < candidates.length) {
        const target = candidates[bestIndex];
        target.focus();
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    },
    [getFocusableElements]
  );

  const focusFirst = useCallback(() => {
    const candidates = getFocusableElements();
    if (candidates.length > 0) {
      candidates[0].focus();
      candidates[0].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [getFocusableElements]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is currently typing in an actual text input or textarea
      const targetTag = (event.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput = targetTag === 'input' || targetTag === 'textarea';

      // Smart TV Remote Back Key codes (webOS: 461, Tizen: 10009)
      if (
        event.key === 'Escape' ||
        event.key === 'Backspace' ||
        event.key === 'GoBack' ||
        event.keyCode === 10009 ||
        event.keyCode === 461
      ) {
        if (!isInput) {
          event.preventDefault();
          onBack?.();
          return;
        }
      }

      // Media keys
      if (event.key === 'MediaPlayPause' || event.code === 'MediaPlayPause') {
        event.preventDefault();
        onPlayPause?.();
        return;
      }
      if (event.key === 'MediaTrackNext') {
        event.preventDefault();
        onNext?.();
        return;
      }
      if (event.key === 'MediaTrackPrevious') {
        event.preventDefault();
        onPrev?.();
        return;
      }
      if (event.key === 'MediaFastForward') {
        event.preventDefault();
        onFastForward?.();
        return;
      }
      if (event.key === 'MediaRewind') {
        event.preventDefault();
        onRewind?.();
        return;
      }

      // Directional arrow navigation
      let dir: Direction | null = null;
      if (event.key === 'ArrowUp') dir = 'up';
      else if (event.key === 'ArrowDown') dir = 'down';
      else if (event.key === 'ArrowLeft') {
        // If in input and cursor not at start, let user type
        if (isInput) return;
        dir = 'left';
      } else if (event.key === 'ArrowRight') {
        if (isInput) return;
        dir = 'right';
      }

      if (dir) {
        event.preventDefault();
        moveFocus(dir);
        return;
      }

      // Enter / OK button
      if (event.key === 'Enter' || event.key === 'NumpadEnter' || event.keyCode === 13) {
        const active = document.activeElement as HTMLElement | null;
        if (active && active.getAttribute('data-tv-focus') === 'true') {
          // If not naturally clicked, trigger click
          active.click();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, moveFocus, onBack, onPlayPause, onNext, onPrev, onFastForward, onRewind]);

  return { focusFirst, moveFocus, getFocusableElements };
}
