import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import { useTheme, Fonts, Type, type AppColors } from '@theme';
import { setAiConsent, lastAiConsentFailure } from '@shared/services/aiConsent';
import { PrimaryButton } from '@mobile/shared/components/PrimaryButton';

/**
 * Asked before PaceX sends anything to the third-party AI (App Store 5.1.2(i)):
 * who receives the data, exactly what is sent, and that it can be turned off.
 * The ai-coach function refuses without the consent this records, so this is the
 * only way in. Used on the Coach screen and on the post-run summary card.
 */
export default function AiConsentCard({ onGranted, onDecline, compact = false }: {
  onGranted: () => void;
  onDecline?: () => void;
  /** Smaller copy for the run summary, where it sits among other cards. */
  compact?: boolean;
}) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const agree = async () => {
    setBusy(true);
    setFailed(false);
    const ok = await setAiConsent(true);
    setBusy(false);
    if (ok) onGranted(); else setFailed(true);
  };

  return (
    <View style={[s.card, compact && s.cardCompact]} accessibilityRole="summary">
      <Text style={s.title}>Turn on PaceX, your AI coach?</Text>
      <Text style={s.body}>
        To coach you, Runivo sends data to <Text style={s.strong}>Anthropic</Text>, the company that provides the AI model.
        Here is exactly what is sent:
      </Text>
      <View style={s.list}>
        <Text style={s.item}>• Your runs: distance, time, pace, heart rate and similar stats</Text>
        <Text style={s.item}>• Your goal, experience, age range and weight, if you added them</Text>
        <Text style={s.item}>• Imported health data, only if you turned that on</Text>
        <Text style={s.item}>• Anything you type to PaceX</Text>
        <Text style={s.item}>• A foot photo, only when you use Foot scan</Text>
      </View>
      <Text style={s.body}>
        Your GPS routes, name and email are not part of it. Anthropic uses the data only to write your reply or read your photo.
        You can turn this off any time in Settings. PaceX gives general running guidance, not medical advice.
      </Text>
      <Pressable onPress={() => Linking.openURL('https://runivo.in/privacy').catch(() => {})} hitSlop={8} accessibilityRole="link">
        <Text style={s.link}>Read the privacy policy</Text>
      </Pressable>

      {failed && (
        <Text style={s.error}>
          {lastAiConsentFailure() === 'server_not_updated'
            ? "Couldn't turn PaceX on right now. Please try again later."
            : lastAiConsentFailure() === 'signed_out'
              ? 'Sign in again, then turn PaceX on.'
              : "Couldn't save that. Check your connection and try again."}
        </Text>
      )}

      <PrimaryButton label="Agree and turn on" onPress={agree} disabled={busy} loading={busy} fullWidth style={{ marginTop: 16 }} />
      {onDecline && (
        <Pressable style={s.secondary} onPress={onDecline} accessibilityRole="button">
          <Text style={s.secondaryTxt}>Not now</Text>
        </Pressable>
      )}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:         { backgroundColor: C.card, borderRadius: 20, padding: 20, margin: 18 },
    cardCompact:  { margin: 0, padding: 16 },
    title:        { ...Type.title, color: C.t1, marginBottom: 10 },
    body:         { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20, color: C.t2, marginTop: 6 },
    strong:       { fontFamily: Fonts.semiBold, color: C.t1 },
    list:         { marginTop: 8, gap: 4 },
    item:         { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20, color: C.t1 },
    link:         { fontFamily: Fonts.semiBold, fontSize: 13.5, color: C.red, marginTop: 12 },
    error:        { fontFamily: Fonts.regular, fontSize: 13, color: C.danger, marginTop: 10 },
    primaryTxt:   { fontFamily: Fonts.semiBold, fontSize: 15, color: C.bg },
    secondary:    { height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    secondaryTxt: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t2 },
  });
}
