import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { PersonSimpleRun } from 'phosphor-react-native';
import { useTheme, Fonts, Type, type AppColors } from '@theme';

interface Props {
  tab?: 'explore' | 'following';
  onCta?: () => void;
}

export function EmptyFeed({ tab, onCta }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const isFollowing = tab === 'following';

  // Following, zero people followed — italic-serif welcome moment, a plain
  // link (not a button) since it just switches the pill to Discover, no
  // screen navigation happening.
  if (isFollowing) {
    return (
      <View style={s.wrap}>
        <Text style={s.headline}>Nobody in your feed yet.</Text>
        <Text style={s.text}>Follow runners to see their runs, conquests, and defenses.</Text>
        {onCta && (
          <Pressable onPress={onCta} hitSlop={8}>
            <Text style={s.link}>Find runners on Discover</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      <View style={s.iconRing}>
        <PersonSimpleRun size={26} color={C.red} weight="light" />
      </View>
      <Text style={[Type.headline, s.title]}>No runs yet</Text>
      <Text style={s.text}>Be the first — complete a run and it lands right here.</Text>
      {onCta && (
        <Pressable style={s.cta} onPress={onCta}>
          <Text style={s.ctaText}>Start a run</Text>
        </Pressable>
      )}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    wrap:     { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 32 },
    iconRing: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.redLo, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    title:    { color: C.black, marginBottom: 6 },
    headline: { fontFamily: Fonts.display, fontSize: 22, lineHeight: 27, color: C.black, textAlign: 'center', marginBottom: 8 },
    text:     { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, textAlign: 'center', lineHeight: 19, maxWidth: 260 },
    link:     { fontFamily: Fonts.semiBold, fontSize: 13, color: C.red, marginTop: 16 },
    cta:      { marginTop: 18, backgroundColor: C.alwaysDark, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
    ctaText:  { fontFamily: Fonts.semiBold, fontSize: 13, color: C.alwaysLight },
  });
}
