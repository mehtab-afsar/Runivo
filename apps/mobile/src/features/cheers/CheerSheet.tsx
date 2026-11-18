/**
 * Send a cheer to a friend who is running now (Home carousel, the live map).
 * Pick a quick message, tap Cheer, see it confirmed.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import * as Haptics from '@theme/hapticsGated';
import { BottomSheet } from '@mobile/shared/components/BottomSheet';
import { Avatar } from '@mobile/shared/components/Avatar';
import { useTheme, Fonts, type AppColors } from '@theme';
import { CheerChips } from './CheerChips';
import { UI, IconText } from '@mobile/shared/icons';
import { CHEERS, sendCheer, type CheerKey, type SendCheerResult } from './cheerService';

export interface CheerTarget { userId: string; username: string; avatarColor?: string }

export const RESULT_TEXT: Record<Exclude<SendCheerResult, 'sent'>, string> = {
  already:     'You already cheered this run.',
  not_live:    'Their run has just ended.',
  too_many:    'That\'s a lot of cheering. Try again in a bit.',
  bad_message: 'Pick one of the cheers.',
};

export function CheerSheet({ target, onClose }: { target: CheerTarget | null; onClose: () => void }) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const [pick, setPick] = useState<CheerKey>('go');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [note, setNote] = useState('');

  useEffect(() => { if (target) { setPick('go'); setState('idle'); setNote(''); } }, [target]);

  const name = target?.username ?? '';
  const send = async () => {
    if (!target || state === 'sending') return;
    setState('sending');
    try {
      const r = await sendCheer(target.userId, pick);
      if (r === 'sent') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setState('sent');
      } else {
        setNote(RESULT_TEXT[r]);
        setState('failed');
      }
    } catch {
      setNote('Couldn\'t reach Runivo. Try again.');
      setState('failed');
    }
  };

  return (
    <BottomSheet visible={!!target} onClose={onClose} maxHeight={0.5}>
      <View style={s.body}>
        <View style={s.head}>
          <Avatar name={name} color={target?.avatarColor} size={46} />
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{name} is running</Text>
            <Text style={s.sub}>They hear your cheer as a voice cue.</Text>
          </View>
        </View>

        {state === 'sent' ? (
          <View style={s.sent} accessibilityLiveRegion="polite">
            <View style={s.sentIcon}><UI.cheer size={24} color={C.red} weight="fill" /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.sentTitle}>Cheer sent</Text>
              <Text style={s.sentSub}>"{CHEERS.find(c => c.key === pick)?.label(name)}"</Text>
            </View>
          </View>
        ) : (
          <>
            <Text style={s.label}>Pick a cheer</Text>
            <CheerChips name={name} value={pick} onChange={setPick} />
            {state === 'failed' && <Text style={s.note}>{note}</Text>}
          </>
        )}

        <Pressable
          style={[s.cta, state === 'sent' && s.ctaDone]} onPress={state === 'sent' ? onClose : send}
          accessibilityRole="button" disabled={state === 'sending'}
        >
          {state === 'sending'
            ? <ActivityIndicator color={C.alwaysDark} />
            : state === 'sent' ? <Text style={[s.ctaTxt, { color: C.t1 }]}>Done</Text> : <IconText Icon={UI.cheer} text="Cheer" color={C.alwaysDark} textStyle={s.ctaTxt} />}
        </Pressable>
        <Text style={s.foot}>One cheer per friend per run.</Text>
      </View>
    </BottomSheet>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    body:      { paddingHorizontal: 20, paddingBottom: 28, gap: 14 },
    head:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
    title:     { fontFamily: Fonts.semiBold, fontSize: 19, color: C.t1 },
    sub:       { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, marginTop: 2 },
    label:     { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    note:      { fontFamily: Fonts.regular, fontSize: 13, color: C.danger },
    sent:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, backgroundColor: C.mint },
    sentIcon:  { width: 44, height: 44, borderRadius: 22, backgroundColor: C.greenBg, alignItems: 'center', justifyContent: 'center' },
    sentTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    sentSub:   { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, marginTop: 2 },
    cta:       { height: 56, borderRadius: 28, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center' },
    ctaDone:   { backgroundColor: C.surface },
    ctaTxt:    { fontFamily: Fonts.bold, fontSize: 17, color: C.alwaysDark },
    foot:      { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, textAlign: 'center' },
  });
}
