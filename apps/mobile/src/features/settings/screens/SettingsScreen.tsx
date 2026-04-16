import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, SafeAreaView,
  Platform, Switch, Alert, Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useSettings } from '../hooks/useSettings';
import { SettingRow } from '../components/SettingRow';
import { SettingSection } from '../components/SettingSection';
import { SegmentedControl, PillCycle } from '../components/SettingToggle';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const C = {
  bg: '#F8F6F3', white: '#FFF', border: '#DDD9D4',
  black: '#0A0A0A', t2: '#6B6B6B', t3: '#ADADAD',
  red: '#D93518', redBg: '#FEF0EE',
  proStart: '#D93518', proEnd: '#D03A4F',
};

export default function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const {
    settings, updateSetting, signOut,
    cycleCountdown, cycleDifficulty, cycleBeatPacerPace,
    clearHistory, deleteAccount,
  } = useSettings();
  const sw = { trackColor: { true: C.black, false: C.border }, thumbColor: C.white };

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
          <Pressable style={s.linkRow} onPress={() => navigation.navigate('Profile')}>
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
          <Pressable style={s.linkRow} onPress={() => Alert.alert('Change Password', 'A password reset link will be sent to your email.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Send', onPress: () => {} }])}>
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
            <Switch value={settings.soundEnabled} onValueChange={v => updateSetting({ soundEnabled: v })} {...sw} />
          </SettingRow>
          <SettingRow label="Haptic feedback">
            <Switch value={settings.hapticEnabled} onValueChange={v => updateSetting({ hapticEnabled: v })} {...sw} />
          </SettingRow>
        </SettingSection>

        {/* ── Beat Pacer ── */}
        <SettingSection title="Beat Pacer">
          <SettingRow label="Enable Beat Pacer" sub="Audible rhythm to maintain pace">
            <Switch value={settings.beatPacerEnabled} onValueChange={v => updateSetting({ beatPacerEnabled: v })} {...sw} />
          </SettingRow>
          {settings.beatPacerEnabled && (
            <>
              <SettingRow label="Target Pace" sub="min/km">
                <PillCycle value={settings.beatPacerPace} onPress={cycleBeatPacerPace} />
              </SettingRow>
              <SettingRow label="Sound">
                <SegmentedControl
                  options={['Click', 'Woodblock', 'Hi-hat']}
                  value={settings.beatPacerSound === 'click' ? 'Click' : settings.beatPacerSound === 'woodblock' ? 'Woodblock' : 'Hi-hat'}
                  onChange={v => updateSetting({ beatPacerSound: v === 'Click' ? 'click' : v === 'Woodblock' ? 'woodblock' : 'hihat' })}
                />
              </SettingRow>
              <SettingRow label="Accent beat" sub="Emphasise first beat of each bar">
                <Switch value={settings.beatPacerAccent} onValueChange={v => updateSetting({ beatPacerAccent: v })} {...sw} />
              </SettingRow>
            </>
          )}
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

        {/* ── Missions ── */}
        <SettingSection title="Missions">
          <SettingRow label="Daily missions" sub="Generate new missions each day">
            <Switch value={settings.dailyMissionsEnabled} onValueChange={v => updateSetting({ dailyMissionsEnabled: v })} {...sw} />
          </SettingRow>
          <SettingRow label="Mission difficulty">
            <PillCycle value={settings.missionDifficulty} onPress={cycleDifficulty} />
          </SettingRow>
        </SettingSection>

        {/* ── Devices ── */}
        <SettingSection title="Devices">
          <Pressable style={s.linkRow} onPress={() => navigation.navigate('ConnectedDevices')}>
            <View style={{ flex: 1 }}>
              <Text style={s.linkLabel}>Connected Devices</Text>
              <Text style={s.linkSub}>Apple Health, Garmin, COROS…</Text>
            </View>
            <Text style={s.linkArrow}>→</Text>
          </Pressable>
        </SettingSection>

        {/* ── Data & Privacy ── */}
        <SettingSection title="Data & Privacy">
          <Pressable style={s.linkRow} onPress={() => Alert.alert('Export Run Data', 'Export feature coming soon.')}>
            <Text style={s.linkLabel}>Export Run Data</Text>
            <Text style={s.linkArrow}>→</Text>
          </Pressable>
          <Pressable style={s.linkRow} onPress={clearHistory}>
            <View style={{ flex: 1 }}>
              <Text style={s.linkLabel}>Clear Run History</Text>
              <Text style={s.linkSub}>Removes local data only</Text>
            </View>
            <Text style={s.linkArrow}>→</Text>
          </Pressable>
          <Pressable style={s.linkRow} onPress={deleteAccount}>
            <Text style={[s.linkLabel, { color: C.red }]}>Delete Account</Text>
            <Text style={s.linkArrow}>→</Text>
          </Pressable>
        </SettingSection>

        {/* ── Support ── */}
        <SettingSection title="Support">
          <Pressable style={s.linkRow} onPress={() => Linking.openURL('https://runivo.app/help')}>
            <Text style={s.linkLabel}>Help & FAQ</Text>
            <Text style={s.linkArrow}>→</Text>
          </Pressable>
          <Pressable style={s.linkRow} onPress={() => Linking.openURL('https://runivo.app/bug-report')}>
            <Text style={s.linkLabel}>Report a Bug</Text>
            <Text style={s.linkArrow}>→</Text>
          </Pressable>
          <View style={s.linkRow}>
            <Text style={s.linkLabel}>About Runivo</Text>
            <Text style={s.versionText}>v1.0.0</Text>
          </View>
        </SettingSection>

        {/* ── Upgrade to Pro ── */}
        <Pressable
          style={s.proCard}
          onPress={() => navigation.navigate('Subscription')}
        >
          <View style={s.proIconBox}>
            <Text style={{ fontSize: 16 }}>⚡</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.proTitle}>Upgrade to Pro</Text>
            <Text style={s.proSub}>Unlock unlimited zones & features</Text>
          </View>
          <Text style={s.proArrow}>→</Text>
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

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12 },
  backBtn:     { width: 32 },
  backText:    { fontFamily: 'Barlow_400Regular', fontSize: 18, color: C.t2 },
  title:       { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: C.black },
  scroll:      { paddingBottom: 40 },
  linkRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 14 },
  linkLabel:   { fontFamily: 'Barlow_400Regular', fontSize: 14, color: C.black },
  linkSub:     { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3, marginTop: 1 },
  linkArrow:   { fontFamily: 'Barlow_300Light', fontSize: 16, color: C.t3 },
  versionText: { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t3 },
  // Upgrade card
  proCard:     { marginHorizontal: 16, marginBottom: 16, borderRadius: 14, backgroundColor: C.proStart, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  proIconBox:  { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  proTitle:    { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: C.white },
  proSub:      { fontFamily: 'Barlow_300Light', fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  proArrow:    { fontFamily: 'Barlow_300Light', fontSize: 16, color: 'rgba(255,255,255,0.7)' },
  // Sign out
  signOutWrap: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  signOutBtn:  { borderWidth: 0.5, borderColor: C.red, borderRadius: 8, paddingVertical: 13, alignItems: 'center' },
  signOutLabel:{ fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.red, textTransform: 'uppercase', letterSpacing: 1 },
  version:     { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, textAlign: 'center', paddingBottom: 8 },
});
