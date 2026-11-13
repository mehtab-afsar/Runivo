import React, { useMemo } from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { Pause, Play, UsersThree } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';

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
          ? <Play size={18} color={C.bg} weight="fill" />
          : <Pause size={18} color={C.bg} weight="fill" />}
        <Text style={ss.pauseTxt}>{isPaused ? 'Resume' : 'Pause'}</Text>
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
    controls:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
    sideBtn:      { width: 52, height: 52, borderRadius: 26, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    sideBtnOff:   { backgroundColor: C.bg },
    pauseBtn:     { flex: 1, height: 60, borderRadius: 30, backgroundColor: C.t1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    pauseTxt:     { fontFamily: Fonts.semiBold, fontSize: 15, color: C.bg },
    finishBtn:    { width: 52, height: 52, borderRadius: 26, backgroundColor: C.redLo, alignItems: 'center', justifyContent: 'center' },
    finishSquare: { width: 14, height: 14, borderRadius: 3, backgroundColor: C.red },
    pressed:      { opacity: 0.85, transform: [{ scale: 0.98 }] },
  });
}
