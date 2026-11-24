import React, { useMemo } from 'react';
import { Text, Pressable } from 'react-native';
import { useTheme } from '@theme';
import { joinButtonLabel } from '../../utils/clubDetailFormatters';
import { mkCommonStyles } from './clubDetailStyles';

interface Props {
  clubName: string;
  joining: boolean;
  invite: string | undefined;
  joinPolicy: 'open' | 'invite_only' | undefined;
  onJoin: () => void;
}

/** Shown when the club was opened from a link and the runner is not a member yet. */
export function ClubJoinBanner({ clubName, joining, invite, joinPolicy, onJoin }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkCommonStyles(C), [C]);
  return (
    <Pressable style={[s.invite, { alignSelf: 'stretch', marginHorizontal: 18, marginBottom: 10, alignItems: 'center' }]} onPress={onJoin} disabled={joining} accessibilityRole="button">
      <Text style={s.inviteTxt}>{joinButtonLabel(joining, invite, joinPolicy, clubName)}</Text>
    </Pressable>
  );
}
