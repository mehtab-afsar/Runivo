import React, { useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Pause, Play, UsersThree } from 'phosphor-react-native';
import { useTheme, type AppColors } from '@theme';

interface RunControlsProps {
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  /** Left round button: show or hide friends running live on the map. */
  onFriends?: () => void;
  friendsShown?: boolean;
}

export default function RunControls({ isPaused, onPause, onResume, onStop, onFriends, friendsShown = true }: RunControlsProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <View style={ss.controls}>
      {onFriends && (
        <Pressable
          style={({ pressed }) => [ss.sideBtn, !friendsShown && ss.sideBtnOff, pressed && ss.pressed]}
          onPress={onFriends}
          accessibilityRole="button"
          accessibilityLabel={friendsShown ? 'Hide friends on the map' : 'Show friends on the map'}
        >
          <UsersThree size={22} color={friendsShown ? C.t1 : C.t3} weight="regular" />
        </Pressable>
      )}
      <Pressable
        style={({ pressed }) => [ss.pauseBtn, pressed && ss.pressed]}
        onPress={isPaused ? onResume : onPause}
        accessibilityRole="button"
        accessibilityLabel={isPaused ? 'Resume run' : 'Pause run'}
      >
        {isPaused
          ? <Play size={26} color={C.alwaysLight} weight="fill" />
          : <Pause size={26} color={C.alwaysLight} weight="fill" />}
      </Pressable>

      <Pressable
        style={({ pressed }) => [ss.finishBtn, pressed && ss.pressed]}
        onPress={onStop}
        testID="run-finish-btn"
        accessibilityRole="button"
        accessibilityLabel="Finish run"
      >
        <View style={ss.finishSquare} />
      </Pressable>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    controls:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22 },
    sideBtn:      { width: 56, height: 56, borderRadius: 28, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
    sideBtnOff:   { opacity: 0.55 },
    pauseBtn:     { width: 80, height: 80, borderRadius: 40, backgroundColor: C.alwaysDark, alignItems: 'center', justifyContent: 'center' },
    finishBtn:    { width: 56, height: 56, borderRadius: 28, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
    finishSquare: { width: 16, height: 16, borderRadius: 4, backgroundColor: C.danger },
    pressed:      { opacity: 0.85, transform: [{ scale: 0.98 }] },
  });
}
