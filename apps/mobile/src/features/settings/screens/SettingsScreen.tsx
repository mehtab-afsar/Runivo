import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, SafeAreaView,
  Platform, Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useSettings } from '../hooks/useSettings';
import { SettingRow } from '../components/SettingRow';
import { SettingSection } from '../components/SettingSection';
import { SegmentedControl, PillCycle } from '../components/SettingToggle';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const C = { bg: '#F8F6F3', white: '#FFF', border: '#DDD9D4', black: '#0A0A0A', t2: '#6B6B6B', t3: '#ADADAD', red: '#D93518' };

export default function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const { settings, updateSetting, signOut, cycleCountdown, cycleDifficulty } = useSettings();
  const sw = { trackColor: { true: C.black, false: C.border }, thumbColor: C.white };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}><Text style={s.backText}>←</Text></Pressable>
        <Text style={s.title}>Settings</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <SettingSection title="Units">
          <SettingRow label="Distance unit">
            <SegmentedControl options={['km', 'mi']} value={settings.distanceUnit} onChange={v => updateSetting({ distanceUnit: v as 'km' | 'mi' })} />
          </SettingRow>
        </SettingSection>

        <SettingSection title="Notifications">
          <SettingRow label="Push notifications" sub="Territory captures, kudos, challenges">
            <Switch value={settings.notificationsEnabled} onValueChange={v => updateSetting({ notificationsEnabled: v })} {...sw} />
          </SettingRow>
          <SettingRow label="Weekly summary">
            <Switch value={settings.weeklySummary} onValueChange={v => updateSetting({ weeklySummary: v })} {...sw} />
          </SettingRow>
        </SettingSection>

        <SettingSection title="Run">
          <SettingRow label="Auto-pause" sub="Pause tracking when you stop moving">
            <Switch value={settings.autoPause} onValueChange={v => updateSetting({ autoPause: v })} {...sw} />
          </SettingRow>
          <SettingRow label="GPS accuracy" sub="High accuracy uses more battery">
            <SegmentedControl options={['Standard', 'High']} value={settings.gpsAccuracy === 'high' ? 'High' : 'Standard'} onChange={v => updateSetting({ gpsAccuracy: v === 'High' ? 'high' : 'standard' })} />
          </SettingRow>
          <SettingRow label="Countdown">
            <PillCycle value={`${settings.countdownSeconds}s`} onPress={cycleCountdown} />
          </SettingRow>
        </SettingSection>

        <SettingSection title="Sound & Haptics">
          <SettingRow label="Sound effects">
            <Switch value={settings.soundEnabled} onValueChange={v => updateSetting({ soundEnabled: v })} {...sw} />
          </SettingRow>
          <SettingRow label="Haptic feedback">
            <Switch value={settings.hapticEnabled} onValueChange={v => updateSetting({ hapticEnabled: v })} {...sw} />
          </SettingRow>
        </SettingSection>

        <SettingSection title="Missions">
          <SettingRow label="Daily missions" sub="Generate new missions each day">
            <Switch value={settings.dailyMissionsEnabled} onValueChange={v => updateSetting({ dailyMissionsEnabled: v })} {...sw} />
          </SettingRow>
          <SettingRow label="Mission difficulty">
            <PillCycle value={settings.missionDifficulty} onPress={cycleDifficulty} />
          </SettingRow>
        </SettingSection>

        <SettingSection title="Devices">
          <Pressable style={s.linkRow} onPress={() => navigation.navigate('ConnectedDevices')}>
            <View style={{ flex: 1 }}>
              <Text style={s.linkLabel}>Connected Devices</Text>
              <Text style={s.linkSub}>Apple Health, Garmin, COROS…</Text>
            </View>
            <Text style={s.linkArrow}>→</Text>
          </Pressable>
        </SettingSection>

        <SettingSection title="Subscription">
          <Pressable style={s.linkRow} onPress={() => navigation.navigate('Subscription')}>
            <Text style={s.linkLabel}>Manage subscription</Text>
            <Text style={s.linkArrow}>→</Text>
          </Pressable>
        </SettingSection>

        <View style={s.signOutWrap}>
          <Pressable style={s.signOutBtn} onPress={signOut}>
            <Text style={s.signOutLabel}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12 },
  backBtn: { width: 32 },
  backText: { fontFamily: 'Barlow_400Regular', fontSize: 18, color: C.t2 },
  title: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: C.black },
  scroll: { paddingBottom: 40 },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 14 },
  linkLabel: { fontFamily: 'Barlow_400Regular', fontSize: 14, color: C.black },
  linkSub: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3, marginTop: 1 },
  linkArrow: { fontFamily: 'Barlow_300Light', fontSize: 16, color: C.t3 },
  signOutWrap: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  signOutBtn: { borderWidth: 0.5, borderColor: C.red, borderRadius: 8, paddingVertical: 13, alignItems: 'center' },
  signOutLabel: { fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.red, textTransform: 'uppercase', letterSpacing: 1 },
});
