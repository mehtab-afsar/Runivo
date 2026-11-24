import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { X } from 'phosphor-react-native';
import { useTheme } from '@theme';
import { UI } from '@mobile/shared/icons';
import type { CheerTarget } from '@features/cheers/CheerSheet';
import type { LiveFriendRunner } from '../../hooks/useLiveFriendRuns';
import BeatPacerChip from '../BeatPacerChip';
import { mkPillStyles } from './activeRunPillStyles';

export interface NearestFriend {
  f: LiveFriendRunner;
  m: number;
}

interface Props {
  top: number;
  isRunning: boolean;
  sharingLive: boolean;
  gpsLocked: boolean;
  verb: string;
  nearestFriend: NearestFriend | null;
  friendsShown: boolean;
  pacerBpm: number;
  pacerEnabled: boolean;
  onTogglePacer: () => void;
  onBack: () => void;
  onCheer: (target: CheerTarget) => void;
}

/** Close button, GPS / sharing status pill and the nearest-friend or beat-pacer chip. */
export default function ActiveRunTopBar({
  top, isRunning, sharingLive, gpsLocked, verb, nearestFriend, friendsShown,
  pacerBpm, pacerEnabled, onTogglePacer, onBack, onCheer,
}: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkPillStyles(C), [C]);
  return (
    <View style={[ss.topBar, { top }]}>
      <Pressable onPress={onBack} style={ss.iconPill} hitSlop={12} accessibilityLabel={isRunning ? 'Cancel run' : 'Close'}>
        <X size={16} color={C.t1} weight="bold" />
      </Pressable>
      {isRunning && sharingLive && gpsLocked ? (
        <View style={ss.pill}>
          <View style={[ss.pillDot, { backgroundColor: C.green }]} />
          <Text style={ss.pillTxt}>Sharing live</Text>
        </View>
      ) : isRunning ? (
        <View style={ss.pill}>
          <View style={[ss.pillDot, { backgroundColor: gpsLocked ? C.green : C.amber }]} />
          <Text style={ss.pillTxt}>{gpsLocked ? 'GPS locked' : 'Finding GPS'}</Text>
        </View>
      ) : (
        <View style={ss.pill}><Text style={ss.pillTxt}>Ready to {verb}</Text></View>
      )}
      {nearestFriend && friendsShown ? (
        <Pressable
          style={ss.pill} hitSlop={6}
          onPress={() => onCheer({ userId: nearestFriend.f.userId, username: nearestFriend.f.username, avatarColor: nearestFriend.f.avatarColor })}
          accessibilityRole="button" accessibilityLabel={`Cheer ${nearestFriend.f.username}`}
        >
          <View style={[ss.friendDot, { backgroundColor: nearestFriend.f.avatarColor }]}>
            <Text style={ss.friendInitial}>{(nearestFriend.f.username[0] ?? '?').toUpperCase()}</Text>
          </View>
          <Text style={ss.pillTxt} numberOfLines={1}>
            {nearestFriend.f.username} · {nearestFriend.m >= 1000 ? `${(nearestFriend.m / 1000).toFixed(1)} km` : `${Math.round(nearestFriend.m)} m`}
          </Text>
          <UI.cheer size={16} color={C.t1} weight="fill" />
        </Pressable>
      ) : isRunning ? (
        <BeatPacerChip bpm={pacerBpm} enabled={pacerEnabled} onToggle={onTogglePacer} />
      ) : <View style={{ width: 36 }} />}
    </View>
  );
}
