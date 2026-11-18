/** The card a runner sees when a cheer arrives mid-run. */
import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Avatar } from '@mobile/shared/components/Avatar';
import { useTheme, Fonts, type AppColors } from '@theme';
import { cheerText, type Cheer } from './cheerService';
import { UI, IconText } from '@mobile/shared/icons';

export function CheerToast({ cheer, runnerName, extra, onThank, onMute, onDismiss, top }: {
  cheer: Cheer; runnerName: string; extra: number; top: number;
  onThank: () => void; onMute: () => void; onDismiss: () => void;
}) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const y = useRef(new Animated.Value(-20)).current;
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    y.setValue(-20); o.setValue(0);
    Animated.parallel([
      Animated.spring(y, { toValue: 0, useNativeDriver: true, friction: 7 }),
      Animated.timing(o, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [cheer.id, y, o]);

  return (
    <Animated.View style={[s.card, { top, opacity: o, transform: [{ translateY: y }] }]} accessibilityLiveRegion="assertive" accessibilityRole="alert">
      <Pressable style={s.row} onPress={onDismiss} accessibilityLabel={`${cheer.fromName} cheered you on: ${cheerText(cheer.message, runnerName)}. Tap to close`}>
        <View>
          <Avatar name={cheer.fromName} size={44} />
          <View style={s.clap}><UI.cheer size={14} color={C.alwaysDark} weight="fill" /></View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.from}>{cheer.fromName} cheered you on</Text>
          <Text style={s.msg}>"{cheerText(cheer.message, runnerName)}"</Text>
          {extra > 0 && <Text style={s.more}>{extra} more {extra === 1 ? 'cheer' : 'cheers'} this run</Text>}
        </View>
      </Pressable>
      <View style={s.actions}>
        <Pressable style={[s.btn, { backgroundColor: C.lime }]} onPress={onThank} accessibilityRole="button">
          <IconText Icon={UI.thanks} text="Thank" color={C.alwaysDark} size={16} textStyle={s.btnTxt} gap={6} />
        </Pressable>
        <Pressable style={[s.btn, { backgroundColor: '#2A2C2E' }]} onPress={onMute} accessibilityRole="button" accessibilityLabel="Mute cheers for this run">
          <Text style={[s.btnTxt, { color: C.alwaysLight }]}>Mute cheers</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    card:    {
      position: 'absolute', left: 14, right: 14, zIndex: 40, borderRadius: 24, padding: 14, gap: 12, backgroundColor: C.alwaysDark,
      shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12,
    },
    row:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
    clap:    { position: 'absolute', right: -6, bottom: -4, width: 24, height: 24, borderRadius: 12, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.alwaysDark },
    from:    { fontFamily: Fonts.regular, fontSize: 13, color: '#C9CCC4' },
    msg:     { fontFamily: Fonts.semiBold, fontSize: 19, color: C.alwaysLight, marginTop: 2 },
    more:    { fontFamily: Fonts.regular, fontSize: 12, color: '#C9CCC4', marginTop: 4 },
    actions: { flexDirection: 'row', gap: 8 },
    btn:     { flex: 1, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    btnTxt:  { fontFamily: Fonts.semiBold, fontSize: 14 },
  });
}
