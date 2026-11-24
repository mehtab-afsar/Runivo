import { useState, useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { feedback } from '@theme';

/** Rank-up spring (900 ms in) and the award-unlock sheet (after the rank-up, if both happen). */
export function useRunCelebration(rankedUp: boolean, newAwards: string[] | undefined) {
  const [showAward, setShowAward] = useState(false);
  const rankUpScale   = useRef(new Animated.Value(0.85)).current;
  const rankUpOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (rankedUp) {
      setTimeout(() => {
        feedback.rankUp();
        Animated.parallel([
          Animated.spring(rankUpScale, { toValue: 1, damping: 14, stiffness: 120, useNativeDriver: true }),
          Animated.timing(rankUpOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        ]).start();
      }, 900);
    }
    if (newAwards && newAwards.length > 0) {
      setTimeout(() => {
        setShowAward(true);
        feedback.awardUnlock();
      }, rankedUp ? 2800 : 900);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { showAward, setShowAward, rankUpScale, rankUpOpacity };
}
