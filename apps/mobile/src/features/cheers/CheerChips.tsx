/** The cheer picker, shared by the cheer sheet and a friend's live run. */
import React, { useMemo } from 'react';
import { Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { Megaphone, Fire, FlagCheckered, Hexagon, HandsClapping, type Icon } from 'phosphor-react-native';
import { CHEERS, type CheerKey } from './cheerMessages';

const CHEER_ICONS: Record<CheerKey, Icon> = { go: Megaphone, pace: Fire, home: FlagCheckered, zone: Hexagon, clap: HandsClapping };

export function CheerChips({ name, value, onChange }: { name: string; value: CheerKey; onChange: (k: CheerKey) => void }) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row} accessibilityRole="radiogroup">
      {CHEERS.map(c => {
        const on = c.key === value;
        const I = CHEER_ICONS[c.key];
        return (
          <Pressable key={c.key} onPress={() => onChange(c.key)} style={[s.chip, on && s.chipOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}>
            <I size={18} color={on ? C.lime : C.t1} weight={on ? 'fill' : 'regular'} />
            <Text style={[s.txt, on && { color: C.alwaysLight }]}>{c.label(name)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    row:    { gap: 8, paddingHorizontal: 2 },
    chip:   { height: 42, paddingHorizontal: 14, borderRadius: 21, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, flexDirection: 'row', alignItems: 'center', gap: 8 },
    chipOn: { backgroundColor: C.alwaysDark, borderColor: C.alwaysDark },
    txt:    { fontFamily: Fonts.medium, fontSize: 14, color: C.t1 },
  });
}
