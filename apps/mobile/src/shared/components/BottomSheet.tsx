import React, { useEffect } from 'react';
import { View, Pressable, Dimensions, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, withSpring, useAnimatedStyle, runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '@theme';
import { Spacing } from '@theme';

const { height: SCREEN_H } = Dimensions.get('window');

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: number;
  showHandle?: boolean;
}

export function BottomSheet({
  visible, onClose, children, maxHeight = 0.75, showHandle = true,
}: BottomSheetProps) {
  const C = useTheme();
  const translateY = useSharedValue(SCREEN_H);
  const sheetH     = SCREEN_H * maxHeight;

  useEffect(() => {
    translateY.value = withSpring(visible ? 0 : SCREEN_H, {
      damping: 28, stiffness: 260,
    });
  }, [visible]);

  const panGesture = Gesture.Pan()
    .onUpdate(e => {
      if (e.translationY > 0) translateY.value = e.translationY;
    })
    .onEnd(e => {
      if (e.translationY > 80 || e.velocityY > 500) {
        translateY.value = withSpring(SCREEN_H, { damping: 28, stiffness: 260 });
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, { damping: 28, stiffness: 260 });
      }
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: visible ? 1 : 0,
    pointerEvents: (visible ? 'auto' : 'none') as 'auto' | 'none',
  }));

  return (
    <>
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[styles.sheet, animStyle, {
          height: sheetH,
          backgroundColor: C.surface,
          borderTopLeftRadius:  Spacing.radius.xl,
          borderTopRightRadius: Spacing.radius.xl,
        }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <GestureDetector gesture={panGesture}>
          <View style={styles.handleArea}>
            {showHandle && (
              <View style={[styles.handle, { backgroundColor: C.border }]} />
            )}
          </View>
        </GestureDetector>
        {children}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 100 },
  sheet:      { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 101 },
  handleArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  handle:     { width: 36, height: 4, borderRadius: 2 },
});
