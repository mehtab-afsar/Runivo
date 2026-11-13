import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, SafeAreaView,
  Platform, Switch, Alert, Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { ArrowLeft } from 'phosphor-react-native';
import { useSettings } from '../hooks/useSettings';
import { SettingRow } from '../components/SettingRow';
import { SettingSection } from '../components/SettingSection';
import { SignInMethodsSection } from '../components/SignInMethodsSection';
import { SegmentedControl } from '../components/SettingToggle';
import { rescheduleSessionReminders, DEFAULT_REMINDER_HOUR } from '@features/training/services/sessionReminders';
import { getCachedPlan } from '@features/training/services/planService';
import { getSpeech } from '@mobile/shared/lib/optionalNative';
import { resetVoiceCuesSetting } from '@features/run/hooks/useVoiceCues';

const REMINDER_OPTIONS: { label: string; hour: number | null }[] = [
  { label: 'Off', hour: null }, { label: '12 pm', hour: 12 }, { label: '6 pm', hour: 18 }, { label: '8 pm', hour: 20 },
];
import { RowChevron } from '@mobile/shared/components/RowChevron';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';
import { useAuth } from '@shared/hooks/useAuth';
import { resetPassword } from '@shared/services/auth';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const {
    settings, updateSetting, signOut,
    deleteAccount,
  } = useSettings();
  const sw = { trackColor: { true: C.black, false: C.border }, thumbColor: C.white };
  const { user } = useAuth();

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <ArrowLeft size={16} color={C.t1} weight="regular" />
        </Pressable>
        <Text style={s.title}>Settings</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Account ── */}
        <SettingSection title="Account">
          <Pressable style={s.linkRow} onPress={() => navigation.navigate('Main', { screen: 'Profile' })}>
            <Text style={s.linkLabel}>Edit Profile</Text>
            <RowChevron />
          </Pressable>
          <SettingRow label="Profile Visibility">
            <SegmentedControl
              options={['Public', 'Friends', 'Private']}
              value={
                settings.privacy === 'public' ? 'Public'
                : settings.privacy === 'followers' ? 'Friends'
                : 'Private'
              }
              onChange={v => updateSetting({
                privacy: v === 'Public' ? 'public' : v === 'Friends' ? 'followers' : 'private',
              })}
            />
          </SettingRow>
          <Pressable style={s.linkRow} onPress={() => {
            const email = user?.email;
            if (!email) return;
            // Goes through the shared helper so it targets the real reset page and
            // uses the implicit-flow email client — a bare resetPasswordForEmail on
            // the PKCE app client produces a link the web page cannot redeem.
            resetPassword(email)
              .then(() => Alert.alert('Check your email', `A password reset link has been sent to ${email}.`))
              .catch((e: unknown) => Alert.alert('Error', e instanceof Error ? e.message : 'Could not send reset email.'));
          }}>
            <Text style={s.linkLabel}>Change Password</Text>
            <RowChevron />
          </Pressable>
        </SettingSection>

        {/* ── Sign-in methods: Apple, Google, phone, email on one account ── */}
        <SignInMethodsSection />

        {/* ── Appearance ── */}
        <SettingSection title="Units">
          <SettingRow label="Distance unit">
            <SegmentedControl
              options={['km', 'mi']}
              value={settings.distanceUnit}
              onChange={v => updateSetting({ distanceUnit: v as 'km' | 'mi' })}
            />
          </SettingRow>
        </SettingSection>

        {/* ── Notifications ── */}
        <SettingSection title="Notifications">
          <SettingRow label="Push notifications" sub="Master toggle for all notifications">
            <Switch value={settings.notificationsEnabled} onValueChange={v => updateSetting({ notificationsEnabled: v })} {...sw} />
          </SettingRow>
          <SettingRow label="Run reminders" sub="Streak at risk, and a nudge after a few quiet days">
            <Switch value={settings.runReminders} onValueChange={v => updateSetting({ runReminders: v })} {...sw} />
          </SettingRow>
          <SettingRow label="Territory alerts" sub="Attacks, captures, and zones about to fade">
            <Switch value={settings.territoryAlerts} onValueChange={v => updateSetting({ territoryAlerts: v })} {...sw} />
          </SettingRow>
          <SettingRow label="Achievements and PACE" sub="Rank ups and your weekly PACE cap">
            <Switch value={settings.announceAchievements} onValueChange={v => updateSetting({ announceAchievements: v })} {...sw} />
          </SettingRow>
          <SettingRow label="Training sessions" sub="A reminder the day before each session in your plan">
            <SegmentedControl
              options={REMINDER_OPTIONS.map(o => o.label)}
              value={REMINDER_OPTIONS.find(o => o.hour === (settings.planReminderHour === undefined ? DEFAULT_REMINDER_HOUR : settings.planReminderHour))?.label ?? '6 pm'}
              onChange={label => {
                const hour = REMINDER_OPTIONS.find(o => o.label === label)?.hour ?? null;
                Promise.resolve(updateSetting({ planReminderHour: hour }))
                  .then(() => getCachedPlan())
                  .then(ap => rescheduleSessionReminders(ap?.plan ?? null))
                  .catch(() => {});
              }}
            />
          </SettingRow>
          <SettingRow label="Weekly summary" sub="Monday morning, your week in review">
            <Switch value={settings.weeklySummary} onValueChange={v => updateSetting({ weeklySummary: v })} {...sw} />
          </SettingRow>
          <SettingRow label="Offers and events" sub="Festive challenges and partner rewards">
            <Switch value={settings.offersEnabled ?? true} onValueChange={v => updateSetting({ offersEnabled: v })} {...sw} />
          </SettingRow>
        </SettingSection>

        {/* ── Run ── */}
        <SettingSection title="During a run">
          <SettingRow label="Voice cues" sub={getSpeech() ? 'Each km, the loop closing, zones and workout steps' : 'Available after the next app update'}>
            <Switch
              value={settings.voiceCues !== false}
              onValueChange={v => { Promise.resolve(updateSetting({ voiceCues: v })).then(resetVoiceCuesSetting).catch(() => {}); }}
              disabled={!getSpeech()}
              {...sw}
            />
          </SettingRow>
        </SettingSection>

        <SettingSection title="Privacy">
          <Pressable style={s.linkRow} onPress={() => navigation.navigate('Privacy')} accessibilityRole="button">
            <View style={{ flex: 1 }}>
              <Text style={s.linkLabel}>Privacy controls</Text>
              <Text style={s.linkSub}>Who sees activities, map visibility, private places, leaderboards, zones, blocking, export</Text>
            </View>
            <RowChevron />
          </Pressable>
        </SettingSection>

        {/* ── Data & Privacy ── */}
        <SettingSection title="Legal">
          <Pressable style={s.linkRow} onPress={() => Linking.openURL('https://runivo.app/privacy')}>
            <Text style={s.linkLabel}>Privacy Policy</Text>
            <RowChevron />
          </Pressable>
          <Pressable style={s.linkRow} onPress={() => Linking.openURL('https://runivo.app/terms')}>
            <Text style={s.linkLabel}>Terms of Service</Text>
            <RowChevron />
          </Pressable>
          <Pressable style={s.linkRow} onPress={deleteAccount}>
            <Text style={[s.linkLabel, { color: C.red }]}>Delete Account</Text>
            <RowChevron />
          </Pressable>
        </SettingSection>

        {/* ── Sign Out ── */}
        <View style={s.signOutWrap}>
          <Pressable style={s.signOutBtn} onPress={signOut}>
            <Text style={s.signOutLabel}>Sign out</Text>
          </Pressable>
        </View>

        <Text style={s.version}>Runivo v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) { return StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12 },
  backBtn:     { width: 32 },
  title:       { fontFamily: Fonts.semiBold, fontSize: 20, color: C.black },
  scroll:      { paddingBottom: 40 },
  linkRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 14 },
  linkLabel:   { fontFamily: Fonts.regular, fontSize: 14, color: C.black },
  linkSub:     { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginTop: 1 },
  versionText: { fontFamily: Fonts.regular, fontSize: 12, color: C.t3 },
  // Premium card
  premiumCard:       { marginHorizontal: Spacing.gutter, marginBottom: 16, borderRadius: 16, overflow: 'hidden' },
  premiumGradient:   { padding: 18 },
  premiumTopRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  premiumBrand:      { flexDirection: 'row', alignItems: 'center', gap: 7 },
  premiumBrandLabel: { fontFamily: Fonts.semiBold, fontSize: 11, color: C.alwaysLight },
  premiumBadge:      { backgroundColor: C.gold, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  premiumBadgeTxt:   { fontFamily: Fonts.semiBold, fontSize: 11, color: C.alwaysDark },
  premiumTagline:    { fontFamily: Fonts.light, fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 14, lineHeight: 20 },
  premiumFeature:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  premiumFeatureDot: { fontFamily: Fonts.regular, fontSize: 11, color: C.gold },
  premiumFeatureTxt: { fontFamily: Fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  premiumDivider:    { height: 0.5, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 14 },
  premiumBottomRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  premiumPrice:      { fontFamily: Fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  premiumCTA:        { backgroundColor: C.gold, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  premiumCTATxt:     { fontFamily: Fonts.semiBold, fontSize: 12, color: C.alwaysDark },
  // Sign out
  signOutWrap: { paddingHorizontal: Spacing.gutter, paddingTop: 4, paddingBottom: 8 },
  signOutBtn:  { borderWidth: 0.5, borderColor: C.red, borderRadius: 8, paddingVertical: 13, alignItems: 'center' },
  signOutLabel:{ fontFamily: Fonts.medium, fontSize: 13, color: C.red },
  version:     { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, textAlign: 'center', paddingBottom: 8 },
}); }
