/**
 * Audio duration detection utility.
 * Loads audio metadata via an HTMLAudioElement to detect the true duration in seconds.
 */

export function detectAudioDuration(source: string | File | Blob): Promise<number> {
  return new Promise((resolve) => {
    if (!source) {
      resolve(0);
      return;
    }

    let url = '';
    let isBlobUrl = false;

    if (typeof source === 'string') {
      url = source.trim();
      if (!url) {
        resolve(0);
        return;
      }
    } else if (source instanceof Blob) {
      try {
        url = URL.createObjectURL(source);
        isBlobUrl = true;
      } catch {
        resolve(0);
        return;
      }
    } else {
      resolve(0);
      return;
    }

    const audio = new Audio();
    audio.preload = 'metadata';

    let settled = false;

    const cleanup = () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('durationchange', onLoaded);
      audio.removeEventListener('canplay', onLoaded);
      audio.removeEventListener('error', onError);
      if (isBlobUrl && url) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      }
      audio.src = '';
    };

    const finish = (duration: number) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 0);
    };

    const onLoaded = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        finish(audio.duration);
      }
    };

    const onError = () => {
      finish(0);
    };

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('durationchange', onLoaded);
    audio.addEventListener('canplay', onLoaded);
    audio.addEventListener('error', onError);

    // Timeout fallback after 6 seconds so we don't stall on unreachable URLs
    const timer = setTimeout(() => {
      if (!settled) {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          finish(audio.duration);
        } else {
          finish(0);
        }
      }
    }, 6000);

    try {
      audio.src = url;
      // Some browsers require load() to trigger metadata fetch for audio elements not in DOM
      audio.load();
    } catch {
      clearTimeout(timer);
      finish(0);
    }
  });
}
