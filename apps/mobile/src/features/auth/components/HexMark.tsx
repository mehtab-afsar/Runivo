import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

// Approximate path length for each half-hex polyline (3 segments of ~46px each)
const PATH_LEN = 138;

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);

interface Props {
  size: number;
  color: string;
  fadedOpacity?: number;
  animate?: boolean;
  delay?: number;
}

export default function HexMark({ size, color, fadedOpacity = 0.28, animate = false, delay = 0 }: Props) {
  const progress = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate) return;
    Animated.timing(progress, {
      toValue: 1,
      duration: 700,
      delay,
      useNativeDriver: false,
    }).start();
  }, [animate, delay, progress]);

  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [PATH_LEN, 0],
  });

  if (animate) {
    return (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <AnimatedPolyline
          points="50,4 10.2,27 10.2,73 50,96"
          stroke={color} strokeWidth="5"
          strokeLinejoin="round" strokeLinecap="round"
          opacity={fadedOpacity} fill="none"
          strokeDasharray={PATH_LEN}
          strokeDashoffset={dashOffset as unknown as number}
        />
        <AnimatedPolyline
          points="50,4 89.8,27 89.8,73 50,96"
          stroke={color} strokeWidth="5"
          strokeLinejoin="round" strokeLinecap="round"
          fill="none"
          strokeDasharray={PATH_LEN}
          strokeDashoffset={dashOffset as unknown as number}
        />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Polyline
        points="50,4 10.2,27 10.2,73 50,96"
        stroke={color} strokeWidth="5"
        strokeLinejoin="round" strokeLinecap="round"
        opacity={fadedOpacity} fill="none"
      />
      <Polyline
        points="50,4 89.8,27 89.8,73 50,96"
        stroke={color} strokeWidth="5"
        strokeLinejoin="round" strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
