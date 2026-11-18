/**
 * The "…" menu for another runner: mute, block, report. Used on their profile.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { appAlert } from '@mobile/shared/components/AppAlert';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SpeakerSlash, SpeakerHigh, Prohibit, Flag, Check, CaretLeft } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import {
  blockUser, unblockUser, muteUser, unmuteUser, reportUser, REPORT_REASONS, type ReportReason,
} from '@mobile/shared/services/safetyService';
import { ModalSheet } from '@mobile/shared/components/ModalSheet';

interface Props {
  visible: boolean;
  userId: string;
  username: string;
  blocked: boolean;
  muted: boolean;
  onClose: () => void;
  onChange: (next: { blocked: boolean; muted: boolean }) => void;
}

export default function RunnerSafetySheet({ visible, userId, username, blocked, muted, onClose, onChange }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const [step, setStep] = useState<'menu' | 'report' | 'reported'>('menu');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (visible) setStep('menu'); }, [visible]);

  const run = async (fn: () => Promise<void>, next: { blocked: boolean; muted: boolean }) => {
    setBusy(true);
    try { await fn(); onChange(next); onClose(); }
    catch { appAlert('Something went wrong', 'Check your connection and try again.'); }
    finally { setBusy(false); }
  };

  const confirmBlock = () => {
    appAlert(
      `Block ${username}?`,
      "You'll unfollow each other. They won't see your profile, activities or comments, and can't follow, kudos or comment on you. They aren't told.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => run(() => blockUser(userId), { blocked: true, muted: false }) },
      ],
    );
  };

  const sendReport = async (reason: ReportReason) => {
    setBusy(true);
    try { await reportUser(userId, reason); setStep('reported'); }
    catch { appAlert("Couldn't send the report", 'You can send up to 5 reports a day. Try again later.'); }
    finally { setBusy(false); }
  };

  return (
    <ModalSheet visible={visible} onClose={onClose} padded={false}>
      {busy && <ActivityIndicator style={s.busy} color={C.t2} />}

      {step === 'menu' && (
        <>
          {!blocked && (
            <Pressable
              style={s.row}
              disabled={busy}
              onPress={() => run(() => (muted ? unmuteUser(userId) : muteUser(userId)), { blocked, muted: !muted })}
              accessibilityRole="button"
            >
              {muted ? <SpeakerHigh size={18} color={C.t1} weight="light" /> : <SpeakerSlash size={18} color={C.t1} weight="light" />}
              <View style={{ flex: 1 }}>
                <Text style={s.rowText}>{muted ? `Unmute ${username}` : `Mute ${username}`}</Text>
                {!muted && <Text style={s.rowSub}>Hide their activities from your feed. They aren't told.</Text>}
              </View>
            </Pressable>
          )}
          <Pressable
            style={s.row}
            disabled={busy}
            onPress={blocked ? () => run(() => unblockUser(userId), { blocked: false, muted }) : confirmBlock}
            accessibilityRole="button"
          >
            <Prohibit size={18} color={blocked ? C.t1 : C.danger} weight="light" />
            <View style={{ flex: 1 }}>
              <Text style={[s.rowText, !blocked && { color: C.danger }]}>{blocked ? `Unblock ${username}` : `Block ${username}`}</Text>
              {!blocked && <Text style={s.rowSub}>Neither of you sees the other. Follows are removed.</Text>}
            </View>
          </Pressable>
          <Pressable style={s.row} disabled={busy} onPress={() => setStep('report')} accessibilityRole="button">
            <Flag size={18} color={C.t2} weight="light" />
            <Text style={s.rowText}>Report {username}</Text>
          </Pressable>
        </>
      )}

      {step === 'report' && (
        <>
          <Pressable style={s.backRow} onPress={() => setStep('menu')} accessibilityRole="button">
            <CaretLeft size={14} color={C.t2} weight="bold" />
            <Text style={s.backTxt}>Why are you reporting {username}?</Text>
          </Pressable>
          {REPORT_REASONS.map(r => (
            <Pressable key={r.id} style={s.row} disabled={busy} onPress={() => sendReport(r.id)} accessibilityRole="button">
              <Text style={s.rowText}>{r.label}</Text>
            </Pressable>
          ))}
        </>
      )}

      {step === 'reported' && (
        <View style={s.done}>
          <Check size={22} color={C.green} weight="bold" />
          <Text style={s.doneTitle}>Thanks, we'll take a look</Text>
          <Text style={s.doneSub}>Reports are private. You can also block {username} so neither of you sees the other.</Text>
          {!blocked && (
            <Pressable hitSlop={8} style={s.doneBtn} onPress={confirmBlock} accessibilityRole="button">
              <Text style={s.doneBtnTxt}>Block {username}</Text>
            </Pressable>
          )}
        </View>
      )}

      <Pressable style={s.cancel} onPress={onClose} accessibilityRole="button">
        <Text style={s.cancelText}>{step === 'reported' ? 'Done' : 'Cancel'}</Text>
      </Pressable>
    </ModalSheet>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    busy:       { position: 'absolute', right: 20, top: 16 },
    row:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingVertical: 14 },
    rowText:    { fontFamily: Fonts.medium, fontSize: 14, color: C.t1 },
    rowSub:     { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, marginTop: 2 },
    backRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, paddingVertical: 12 },
    backTxt:    { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    done:       { alignItems: 'center', paddingHorizontal: 28, paddingVertical: 16, gap: 6 },
    doneTitle:  { fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    doneSub:    { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18, color: C.t2, textAlign: 'center' },
    doneBtn:    { marginTop: 8, paddingHorizontal: 18, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    doneBtnTxt: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.red },
    cancel:     { marginTop: 6, marginHorizontal: 16, paddingVertical: 14, borderRadius: 12, backgroundColor: C.stone, alignItems: 'center' },
    cancelText: { fontFamily: Fonts.medium, fontSize: 14, color: C.t2 },
  });
}
