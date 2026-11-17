import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useSettings } from '../hooks/useSettings';
import { SettingRow } from '../components/SettingRow';
import { SettingSection } from '../components/SettingSection';
import { NotificationLimits, FriendZoneAlerts, EmailDigest } from '../components/NotificationLimits';
import { SignInMethodsSection } from '../components/SignInMethodsSection';
import { PrivacyDataSection } from '../components/PrivacyDataSection';
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
import { SUBSCRIPTIONS_ENABLED } from '@shared/engine/entitlements';
import { restorePurchases, manageSubscriptionUrl } from '@features/subscription/services/purchaseService';
import { useSubscription } from '@features/subscription/hooks/useSubscription';
import { ScreenHeader } from '@mobile/shared/components/ScreenHeader';

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
  const [notifOpen, setNotifOpen] = useState(false);
  const notifOnCount = [settings.notificationsEnabled, settings.runReminders, settings.territoryAlerts, settings.announceAchievements, settings.weeklySummary, settings.offersEnabled, settings.planReminderHour !== null].filter(Boolean).length;
  const { isPremium } = useSubscription();

  return (
    <SafeAreaView style={s.root}>
      <ScreenHeader title="Settings" onBack={() => navigation.goBack()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Plus card (mock): status first, before the grouped rows. */}
        <Pressable style={s.plusCard} onPress={() => navigation.navigate('Subscription', {})} accessibilityRole="button">
          <Text style={s.plusEyebrow}>{isPremium ? 'Runivo Plus · active' : 'Runivo Plus'}</Text>
          <Text style={s.plusBody}>{isPremium ? 'Every Plus feature is on for your account.' : 'More zones, a higher PACE cap and the full PaceX coach.'}</Text>
          <View style={s.plusBtn}><Text style={s.plusBtnTxt}>{isPremium ? 'Manage' : 'See Plus'}</Text></View>
        </Pressable>

        {/* ── Account ── */}
        <SettingSection title="Account">
          <Pressable style={s.linkRow} onPress={() => navigation.navigate('Main', { screen: 'Profile' })}>
            <Text style={s.linkLabel}>Edit Profile</Text>
            <RowChevron />
          </Pressable>
          <SettingRow label="Who can see your profile" sub="Stats, zones and awards">
            <SegmentedControl
              options={['Everyone', 'Followers', 'Only me']}
              value={
                settings.privacy === 'public' ? 'Everyone'
                : settings.privacy === 'followers' ? 'Followers'
                : 'Only me'
              }
              onChange={v => updateSetting({
                privacy: v === 'Everyone' ? 'public' : v === 'Followers' ? 'followers' : 'private',
              })}
            />
          </SettingRow>
          {user?.email ? (
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
          ) : null}
          {/* Restore and Manage must be reachable outside the paywall (App Store 3.1.1 / 3.1.2),
              including for someone who already has Plus and so never sees the paywall. */}
          {SUBSCRIPTIONS_ENABLED && (
            <>
              <Pressable style={s.linkRow} onPress={() => navigation.navigate('Subscription', {})}>
                <Text style={s.linkLabel}>Runivo Plus</Text>
                <RowChevron />
              </Pressable>
              <Pressable style={s.linkRow} onPress={async () => {
                const r = await restorePurchases();
                if (r === 'restored') Alert.alert('Purchases restored', 'Your subscription has been restored.');
                else if (r === 'none') Alert.alert('No purchases found', 'No active subscription was found for this Apple ID.');
                else Alert.alert("Couldn't check purchases", 'Check your connection and try again.');
              }}>
                <Text style={s.linkLabel}>Restore purchases</Text>
                <RowChevron />
              </Pressable>
              <Pressable style={s.linkRow} onPress={() => Linking.openURL(manageSubscriptionUrl()).catch(() => {})}>
                <Text style={s.linkLabel}>Manage subscription</Text>
                <RowChevron />
              </Pressable>
            </>
          )}
        </SettingSection>

        {/* ── Consents the runner can take back ── */}
        <PrivacyDataSection />

        {/* ── Sign-in methods: Apple, Google, phone, email on one account ── */}
        <SignInMethodsSection />

        {/* ── Preferences (mock order) ── */}
        <SettingSection title="Preferences">
          <SettingRow label="Distance unit">
            <SegmentedControl
              options={['km', 'mi']}
              value={settings.distanceUnit}
              onChange={v => updateSetting({ distanceUnit: v as 'km' | 'mi' })}
            />
          </SettingRow>
          <SettingRow label="Voice cues" sub={getSpeech() ? 'Each km, the loop closing, zones and workout steps' : 'Available after the next app update'}>
            <Switch
              value={settings.voiceCues !== false}
              onValueChange={v => { Promise.resolve(updateSetting({ voiceCues: v })).then(resetVoiceCuesSetting).catch(() => {}); }}
              disabled={!getSpeech()}
              {...sw}
            />
          </SettingRow>
          <SettingRow label="Haptics" sub="Taps, countdown and run milestones">
            <Switch value={settings.hapticEnabled ?? true} onValueChange={v => updateSetting({ hapticEnabled: v })} {...sw} />
          </SettingRow>
          <SettingRow label="Sounds" sub="Run start, km and zone-claim sounds">
            <Switch value={settings.soundEnabled ?? true} onValueChange={v => updateSetting({ soundEnabled: v })} {...sw} />
          </SettingRow>
        </SettingSection>

        {/* ── Notifications ── */}
        <SettingSection title="Notifications">
          <Pressable style={s.linkRow} onPress={() => setNotifOpen(v => !v)} accessibilityRole="button" accessibilityState={{ expanded: notifOpen }}>
            <Text style={s.linkLabel}>Notifications</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={s.rowValue}>{notifOnCount} on</Text>
              <RowChevron />
            </View>
          </Pressable>
          {notifOpen && <>
          <SettingRow label="Push notifications" sub="Master toggle for all notifications">
            <Switch value={settings.notificationsEnabled} onValueChange={v => updateSetting({ notificationsEnabled: v })} {...sw} />
          </SettingRow>
          <SettingRow label="Run reminders" sub="Streak at risk, and a nudge after a few quiet days">
            <Switch value={settings.runReminders} onValueChange={v => updateSetting({ runReminders: v })} {...sw} />
          </SettingRow>
          <NotificationLimits />
          <FriendZoneAlerts {...sw} />
          {!settings.notificationsEnabled && <EmailDigest {...sw} />}
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
          <SettingRow label="Offers and events" sub="Off by default. Partner rewards and community events">
            <Switch value={settings.offersEnabled ?? false} onValueChange={v => updateSetting({ offersEnabled: v })} {...sw} />
          </SettingRow>
          </>}
        </SettingSection>

        <SettingSection title="Privacy and safety">
          <Pressable style={s.linkRow} onPress={() => navigation.navigate('Privacy')} accessibilityRole="button">
            <View style={{ flex: 1 }}>
              <Text style={s.linkLabel}>Privacy controls</Text>
              <Text style={s.linkSub}>Who sees activities, map visibility, private places, leaderboards, zones, blocking, export</Text>
            </View>
            <RowChevron />
          </Pressable>
        </SettingSection>

        {/* ── Data & Privacy ── */}
        <SettingSection title="Support">
          <Pressable style={s.linkRow} onPress={() => Linking.openURL('https://runivo.app/privacy')}>
            <Text style={s.linkLabel}>Privacy Policy</Text>
            <RowChevron />
          </Pressable>
          <Pressable style={s.linkRow} onPress={() => Linking.openURL('https://runivo.app/terms')}>
            <Text style={s.linkLabel}>Terms of Service</Text>
            <RowChevron />
          </Pressable>
        </SettingSection>

        {/* ── Sign Out ── */}
        <View style={s.signOutWrap}>
          <Pressable style={s.signOutBtn} onPress={signOut} accessibilityRole="button">
            <Text style={s.signOutLabel}>Sign out</Text>
          </Pressable>
        </View>

        {/* Destructive and irreversible: its own section, away from the Legal links. */}
        <View style={s.dangerWrap}>
          <Pressable style={s.dangerBtn} onPress={deleteAccount} accessibilityRole="button" accessibilityHint="Permanently deletes your account and all data. Asks you to confirm twice.">
            <Text style={s.dangerLabel}>Delete account</Text>
          </Pressable>
        </View>

        <Text style={s.version}>Runivo v{Constants.expoConfig?.version ?? ''}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) { return StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg },
  scroll:      { paddingBottom: 40 },
  linkRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, minHeight: 56 },
  linkLabel:   { fontFamily: Fonts.regular, fontSize: 16, color: C.t1 },
  rowValue:    { fontFamily: Fonts.regular, fontSize: 15, color: C.t2 },
  plusCard:    { marginHorizontal: Spacing.gutter, marginTop: 8, backgroundColor: C.alwaysDark, borderRadius: 26, padding: 20, gap: 6 },
  plusEyebrow: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.lime },
  plusBody:    { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 21, color: C.alwaysLight },
  plusBtn:     { alignSelf: 'flex-start', marginTop: 8, height: 38, paddingHorizontal: 18, borderRadius: 19, backgroundColor: C.lime, justifyContent: 'center' },
  plusBtnTxt:  { fontFamily: Fonts.semiBold, fontSize: 14, color: C.alwaysDark },
  linkSub:     { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, marginTop: 1 },
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
  dangerWrap:  { paddingHorizontal: Spacing.gutter, paddingTop: 4, paddingBottom: 12 },
  dangerBtn:   { paddingVertical: 13, alignItems: 'center' },
  dangerLabel: { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, textDecorationLine: 'underline' },
  version:     { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, textAlign: 'center', paddingBottom: 8 },
}); }
