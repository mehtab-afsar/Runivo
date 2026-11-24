import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Flag } from 'phosphor-react-native';
import { useTheme } from '@theme';
import { ScreenHeader, HeaderButton } from '@mobile/shared/components/ScreenHeader';
import { promptReport } from '@mobile/shared/lib/promptReport';
import type { ClubRole } from '../../utils/clubDetailFormatters';
import { mkCommonStyles } from './clubDetailStyles';

interface Props {
  clubId: string;
  clubName: string;
  role: ClubRole | null;
  onBack: () => void;
  onInvite: () => void;
}

/** Header (mock): back, Invite; report sits in the menu for non-admins. */
export function ClubTopBar({ clubId, clubName, role, onBack, onInvite }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkCommonStyles(C), [C]);
  return (
    <ScreenHeader title="" onBack={onBack} right={(
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {role !== 'admin' && (
          <HeaderButton onPress={() => promptReport('club', clubId, 'club')} label="Report this club">
            <Flag size={16} color={C.t2} weight="regular" />
          </HeaderButton>
        )}
        <Pressable style={s.invite} onPress={onInvite} accessibilityRole="button" accessibilityLabel={`Invite people to ${clubName}`}><Text style={s.inviteTxt}>Invite</Text></Pressable>
      </View>
    )} />
  );
}
