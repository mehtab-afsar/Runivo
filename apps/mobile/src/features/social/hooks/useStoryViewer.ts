import { useState, useEffect, useCallback, useRef } from 'react';
import type { StoryGroup } from '@features/social/services/storyService';

const STORY_DURATION_MS = 5000;

export function useStoryViewer(groups: StoryGroup[], initialGroupIndex = 0, onClose: () => void) {
  const [groupIdx, setGroupIdx] = useState(initialGroupIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [loading] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const pausedRef = useRef(false);
  const elapsedRef = useRef(0);

  const currentGroup = groups[groupIdx];
  const totalStories = currentGroup?.stories.length ?? 0;

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startTimer = useCallback((remainingMs: number) => {
    stopTimer();
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      if (pausedRef.current) return;
      const elapsed = elapsedRef.current + (Date.now() - startTimeRef.current);
      const p = Math.min(elapsed / STORY_DURATION_MS, 1);
      setProgress(p);
      if (p >= 1) {
        stopTimer();
        setStoryIdx((si) => {
          if (si < totalStories - 1) { elapsedRef.current = 0; return si + 1; }
          setGroupIdx((gi) => {
            if (gi < groups.length - 1) { setStoryIdx(0); elapsedRef.current = 0; return gi + 1; }
            onClose();
            return gi;
          });
          return 0;
        });
      }
    }, 50);
  }, [stopTimer, totalStories, groups.length, onClose]);

  useEffect(() => {
    elapsedRef.current = 0;
    setProgress(0);
    startTimer(STORY_DURATION_MS);
    return stopTimer;
  }, [groupIdx, storyIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = useCallback(() => {
    stopTimer();
    elapsedRef.current = 0;
    setStoryIdx((si) => {
      if (si < totalStories - 1) return si + 1;
      setGroupIdx((gi) => {
        if (gi < groups.length - 1) { setStoryIdx(0); return gi + 1; }
        onClose();
        return gi;
      });
      return 0;
    });
  }, [stopTimer, totalStories, groups.length, onClose]);

  const prev = useCallback(() => {
    stopTimer();
    elapsedRef.current = 0;
    if (storyIdx > 0) {
      setStoryIdx((s) => s - 1);
    } else if (groupIdx > 0) {
      setGroupIdx((g) => g - 1);
      setStoryIdx(0);
    }
  }, [stopTimer, storyIdx, groupIdx]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    elapsedRef.current += Date.now() - startTimeRef.current;
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
    startTimeRef.current = Date.now();
  }, []);

  return {
    currentGroup,
    groupIdx,
    storyIdx,
    progress,
    loading,
    next,
    prev,
    pause,
    resume,
    close: onClose,
  };
}
