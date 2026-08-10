import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Compass, PersonSimpleRun } from 'phosphor-react-native';
import { useTheme, Fonts, Type, type AppColors } from '@theme';

interface Props {
  tab?: 'explore' | 'following';
  onCta?: () => void;
}

export function EmptyFeed({ tab, onCta }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const isFollowing = tab === 'following';

  const title = isFollowing ? 'No one to follow yet' : 'No runs yet';
  const body = isFollowing
    ? 'Follow a few runners in Discover and their runs will show up here.'
    : 'Be the first — complete a run and it lands right here.';
  const ctaLabel = isFollowing ? 'Go to Discover' : 'Start a run';

  return (
    <View style={s.wrap}>
      <View style={s.iconRing}>
        {isFollowing
          ? <Compass size={26} color={C.red} weight="light" />
          : <PersonSimpleRun size={26} color={C.red} weight="light" />}
      </View>
      <Text style={[Type.headline, s.title]}>{title}</Text>
      <Text style={s.text}>{body}</Text>
      {onCta && (
        <Pressable style={s.cta} onPress={onCta}>
          <Text style={s.ctaText}>{ctaLabel}</Text>
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
    text:     { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, textAlign: 'center', lineHeight: 19, maxWidth: 260 },
    cta:      { marginTop: 18, backgroundColor: C.alwaysDark, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
    ctaText:  { fontFamily: Fonts.semiBold, fontSize: 13, color: C.alwaysLight },
  });
}
