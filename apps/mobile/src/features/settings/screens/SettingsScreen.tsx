import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, SafeAreaView,
  Platform, Switch, Alert, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { Crown } from 'phosphor-react-native';
import { useSettings } from '../hooks/useSettings';
import { SettingRow } from '../components/SettingRow';
import { SettingSection } from '../components/SettingSection';
import { SegmentedControl, PillCycle } from '../components/SettingToggle';
import { useTheme, setSoundEnabled, setHapticEnabled, Fonts, Spacing, type AppColors } from '@theme';
import { useAuth } from '@shared/hooks/useAuth';
import { supabase } from '@shared/services/supabase';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const {
    settings, updateSetting, signOut,
    cycleCountdown, cycleDifficulty, cycleBeatPacerPace,
    clearHistory, deleteAccount,
  } = useSettings();
  const sw = { trackColor: { true: C.black, false: C.border }, thumbColor: C.white };
  const { user } = useAuth();

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </Pressable>
        <Text style={s.title}>Settings</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Account ── */}
        <SettingSection title="Account">
          <Pressable style={s.linkRow} onPress={() => navigation.navigate('Main', { screen: 'Profile' })}>
            <Text style={s.linkLabel}>Edit Profile</Text>
            <Text style={s.linkArrow}>→</Text>
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
            supabase.auth.resetPasswordForEmail(email).then(({ error }) => {
              if (error) Alert.alert('Error', error.message);
              else Alert.alert('Check your email', `A password reset link has been sent to ${email}.`);
            });
          }}>
            <Text style={s.linkLabel}>Change Password</Text>
            <Text style={s.linkArrow}>→</Text>
          </Pressable>
        </SettingSection>

        {/* ── Appearance ── */}
        <SettingSection title="Appearance">
          <SettingRow label="Distance unit">
            <SegmentedControl
              options={['km', 'mi']}
              value={settings.distanceUnit}
              onChange={v => updateSetting({ distanceUnit: v as 'km' | 'mi' })}
            />
          </SettingRow>
          <SettingRow label="Dark Mode">
            <Switch
              value={settings.darkMode}
              onValueChange={v => updateSetting({ darkMode: v })}
              {...sw}
            />
          </SettingRow>
          <SettingRow label="Map Style">
            <PillCycle
              value={settings.mapStyle ?? 'Standard'}
              onPress={() => {
                const opts = ['Standard', 'Dark', 'Light', 'Terrain', 'Satellite'];
                const idx = opts.indexOf(settings.mapStyle ?? 'Standard');
                updateSetting({ mapStyle: opts[(idx + 1) % opts.length] as any });
              }}
            />
          </SettingRow>
        </SettingSection>

        {/* ── Notifications ── */}
        <SettingSection title="Notifications">
          <SettingRow label="Push notifications" sub="Master toggle for all notifications">
            <Switch value={settings.notificationsEnabled} onValueChange={v => updateSetting({ notificationsEnabled: v })} {...sw} />
          </SettingRow>
          <SettingRow label="Run reminders" sub="Nudges when you haven't run in a while">
            <Switch value={settings.runReminders} onValueChange={v => updateSetting({ runReminders: v })} {...sw} />
          </SettingRow>
          <SettingRow label="Territory alerts" sub="Zone captures and attacks">
            <Switch value={settings.territoryAlerts} onValueChange={v => updateSetting({ territoryAlerts: v })} {...sw} />
          </SettingRow>
          <SettingRow label="Announce achievements">
            <Switch value={settings.announceAchievements} onValueChange={v => updateSetting({ announceAchievements: v })} {...sw} />
          </SettingRow>
          <SettingRow label="Weekly summary">
            <Switch value={settings.weeklySummary} onValueChange={v => updateSetting({ weeklySummary: v })} {...sw} />
          </SettingRow>
        </SettingSection>

        {/* ── Sound & Haptics ── */}
        <SettingSection title="Sound & Haptics">
          <SettingRow label="Sound effects">
            <Switch value={settings.soundEnabled} onValueChange={v => { updateSetting({ soundEnabled: v }); setSoundEnabled(v); }} {...sw} />
          </SettingRow>
          <SettingRow label="Haptic feedback">
            <Switch value={settings.hapticEnabled} onValueChange={v => { updateSetting({ hapticEnabled: v }); setHapticEnabled(v); }} {...sw} />
          </SettingRow>
        </SettingSection>

        {/* ── Run ── */}
        <SettingSection title="Run Settings">
          <SettingRow label="Auto-pause" sub="Pause tracking when you stop moving">
            <Switch value={settings.autoPause} onValueChange={v => updateSetting({ autoPause: v })} {...sw} />
          </SettingRow>
          <SettingRow label="GPS accuracy" sub="High accuracy uses more battery">
            <SegmentedControl
              options={['Standard', 'High']}
              value={settings.gpsAccuracy === 'high' ? 'High' : 'Standard'}
              onChange={v => updateSetting({ gpsAccuracy: v === 'High' ? 'high' : 'standard' })}
            />
          </SettingRow>
          <SettingRow label="Countdown">
            <PillCycle value={`${settings.countdownSeconds}s`} onPress={cycleCountdown} />
          </SettingRow>
        </SettingSection>

        {/* ── Data & Privacy ── */}
        <SettingSection title="Data & Privacy">
          <Pressable style={s.linkRow} onPress={() => Linking.openURL('https://runivo.app/privacy')}>
            <Text style={s.linkLabel}>Privacy Policy</Text>
            <Text style={s.linkArrow}>→</Text>
          </Pressable>
          <Pressable style={s.linkRow} onPress={() => Linking.openURL('https://runivo.app/terms')}>
            <Text style={s.linkLabel}>Terms of Service</Text>
            <Text style={s.linkArrow}>→</Text>
          </Pressable>
          <Pressable style={s.linkRow} onPress={deleteAccount}>
            <Text style={[s.linkLabel, { color: C.red }]}>Delete Account</Text>
            <Text style={s.linkArrow}>→</Text>
          </Pressable>
        </SettingSection>

        {/* ── About ── */}
        <SettingSection title="About">
          <Pressable style={s.linkRow} onPress={() => Linking.openURL('https://runivo.app/help')}>
            <Text style={s.linkLabel}>Help & FAQ</Text>
            <Text style={s.linkArrow}>→</Text>
          </Pressable>
          <Pressable style={s.linkRow} onPress={() => Linking.openURL('https://runivo.app/bug-report')}>
            <Text style={s.linkLabel}>Report a Bug</Text>
            <Text style={s.linkArrow}>→</Text>
          </Pressable>
          <View style={s.linkRow}>
            <Text style={s.linkLabel}>App Version</Text>
            <Text style={s.versionText}>v1.0.0</Text>
          </View>
        </SettingSection>

        {/* ── Premium card ── */}
        <Pressable style={s.premiumCard} onPress={() => navigation.navigate('Subscription')}>
          <LinearGradient colors={['#111111', '#1A0A06']} style={s.premiumGradient}>
            <View style={s.premiumTopRow}>
              <View style={s.premiumBrand}>
                <Crown size={14} color={C.gold} weight="fill" />
                <Text style={s.premiumBrandLabel}>RUNIVO PLUS</Text>
              </View>
              <View style={s.premiumBadge}><Text style={s.premiumBadgeTxt}>PLUS</Text></View>
            </View>
            <Text style={s.premiumTagline}>Dominate more territory.{'\n'}Run smarter.</Text>
            {['Unlimited territory zones', 'AI Coach', 'Territory alerts'].map(f => (
              <View key={f} style={s.premiumFeature}>
                <Text style={s.premiumFeatureDot}>✦</Text>
                <Text style={s.premiumFeatureTxt}>{f}</Text>
              </View>
            ))}
            <View style={s.premiumDivider} />
            <View style={s.premiumBottomRow}>
              <Text style={s.premiumPrice}>From $4.99/mo after free trial</Text>
              <View style={s.premiumCTA}><Text style={s.premiumCTATxt}>Upgrade →</Text></View>
            </View>
          </LinearGradient>
        </Pressable>

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
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12 },
  backBtn:     { width: 32 },
  backText:    { fontFamily: Fonts.regular, fontSize: 18, color: C.t2 },
  title:       { fontFamily: Fonts.display, fontSize: 20, color: C.black },
  scroll:      { paddingBottom: 40 },
  linkRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 14 },
  linkLabel:   { fontFamily: Fonts.regular, fontSize: 14, color: C.black },
  linkSub:     { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginTop: 1 },
  linkArrow:   { fontFamily: Fonts.regular, fontSize: 16, color: C.t3 },
  versionText: { fontFamily: Fonts.regular, fontSize: 12, color: C.t3 },
  // Premium card
  premiumCard:       { marginHorizontal: Spacing.gutter, marginBottom: 16, borderRadius: 16, overflow: 'hidden' },
  premiumGradient:   { padding: 18 },
  premiumTopRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  premiumBrand:      { flexDirection: 'row', alignItems: 'center', gap: 7 },
  premiumBrandLabel: { fontFamily: Fonts.semiBold, fontSize: 11, color: C.alwaysLight, letterSpacing: 1.5 },
  premiumBadge:      { backgroundColor: C.gold, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  premiumBadgeTxt:   { fontFamily: Fonts.semiBold, fontSize: 10, color: C.alwaysDark, letterSpacing: 1 },
  premiumTagline:    { fontFamily: Fonts.light, fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 14, lineHeight: 20 },
  premiumFeature:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  premiumFeatureDot: { fontFamily: Fonts.regular, fontSize: 10, color: C.gold },
  premiumFeatureTxt: { fontFamily: Fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  premiumDivider:    { height: 0.5, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 14 },
  premiumBottomRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  premiumPrice:      { fontFamily: Fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  premiumCTA:        { backgroundColor: C.gold, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  premiumCTATxt:     { fontFamily: Fonts.semiBold, fontSize: 12, color: C.alwaysDark },
  // Sign out
  signOutWrap: { paddingHorizontal: Spacing.gutter, paddingTop: 4, paddingBottom: 8 },
  signOutBtn:  { borderWidth: 0.5, borderColor: C.red, borderRadius: 8, paddingVertical: 13, alignItems: 'center' },
  signOutLabel:{ fontFamily: Fonts.medium, fontSize: 13, color: C.red, letterSpacing: 1 },
  version:     { fontFamily: Fonts.regular, fontSize: 10, color: C.t3, textAlign: 'center', paddingBottom: 8 },
}); }
