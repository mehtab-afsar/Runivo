/**
 * ConnectedDevicesScreen — Apple Health + Garmin / COROS / Polar OAuth.
 *
 * OAuth flow (mobile):
 *  1. Fetch authorize URL from device-oauth edge function
 *  2. Open in system browser via Linking.openURL
 *  3. Provider redirects to runivo://settings/devices?provider=X&code=Y
 *  4. Linking listener catches the URL and calls completeOAuth
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  SafeAreaView, Platform, ActivityIndicator, Linking, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '@shared/services/supabase';
import {
  writeRunToHealth,
  readRecentWorkouts,
} from '../../../shared/services/healthService';

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:      '#F8F6F3',
  white:   '#FFFFFF',
  ink:     '#0A0A0A',
  mid:     '#6B6B6B',
  muted:   '#ADADAD',
  border:  '#E8E4DF',
  green:   '#1A6B40',
  greenLo: '#EDF7F2',
  red:     '#D93518',
  redLo:   '#FEF0EE',
  purple:  '#5A3A8A',
  purpleLo:'#F2EEF9',
};

// ── Types ──────────────────────────────────────────────────────────────────────

type DeviceKey = 'apple_health' | 'garmin' | 'coros' | 'polar';
type ConnectionStatus = 'connected' | 'disconnected' | 'unavailable' | 'loading';

interface DeviceInfo {
  key:            DeviceKey;
  name:           string;
  logo:           string;
  description:    string;
  iosOnly?:       boolean;
  oauthProvider?: string;
}

const DEVICES: DeviceInfo[] = [
  {
    key:         'apple_health',
    name:        'Apple Health',
    logo:        '❤️',
    description: 'Sync runs automatically from the Health app.',
    iosOnly:     true,
  },
  {
    key:           'garmin',
    name:          'Garmin Connect',
    logo:          '🟣',
    description:   'Import runs with HR, cadence & elevation from Garmin watches.',
    oauthProvider: 'garmin',
  },
  {
    key:           'coros',
    name:          'COROS',
    logo:          '⚫',
    description:   'Pull training data from COROS PACE, APEX and VERTIX watches.',
    oauthProvider: 'coros',
  },
  {
    key:           'polar',
    name:          'Polar Flow',
    logo:          '🔴',
    description:   'Connect Polar watches for recovery & HRV metrics.',
    oauthProvider: 'polar',
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatSyncTime(iso: string | null): string {
  if (!iso) return 'Never synced';
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1)  return 'Just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

async function getSupabaseFnUrl(path: string): Promise<string> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  return `${supabaseUrl}/functions/v1/${path}`;
}

async function getOAuthAuthUrl(provider: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');
  const fnUrl = await getSupabaseFnUrl(`device-oauth?provider=${provider}&action=authorize`);
  const res = await fetch(fnUrl, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  const { url } = await res.json() as { url: string };
  return url;
}

async function completeOAuthCallback(
  provider: string,
  params: { code?: string; oauth_token?: string; oauth_verifier?: string },
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');
  const fnUrl = await getSupabaseFnUrl('device-oauth');
  const res = await fetch(fnUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body:    JSON.stringify({ provider, action: 'callback', ...params }),
  });
  if (!res.ok) throw new Error(await res.text());
}

async function disconnectOAuth(provider: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const fnUrl = await getSupabaseFnUrl('device-oauth');
  await fetch(fnUrl, {
    method:  'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body:    JSON.stringify({ provider }),
  });
}

async function getOAuthConnection(deviceType: string): Promise<{
  status:     'connected' | 'disconnected';
  lastSyncAt: string | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 'disconnected', lastSyncAt: null };
  const { data } = await supabase
    .from('device_connections')
    .select('status, last_sync_at')
    .eq('user_id', user.id)
    .eq('device_type', deviceType)
    .single();
  if (!data) return { status: 'disconnected', lastSyncAt: null };
  return { status: data.status as 'connected' | 'disconnected', lastSyncAt: data.last_sync_at ?? null };
}

async function getAppleHealthConnection(): Promise<{
  status:     'connected' | 'disconnected';
  lastSyncAt: string | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 'disconnected', lastSyncAt: null };
  const { data } = await supabase
    .from('device_connections')
    .select('status, last_sync_at')
    .eq('user_id', user.id)
    .eq('device_type', 'apple_health')
    .single();
  if (!data) return { status: 'disconnected', lastSyncAt: null };
  return { status: data.status as 'connected' | 'disconnected', lastSyncAt: data.last_sync_at ?? null };
}

async function saveAppleHealthConnection(connected: boolean): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('device_connections').upsert({
    user_id:     user.id,
    device_type: 'apple_health',
    status:      connected ? 'connected' : 'disconnected',
    last_sync_at: connected ? new Date().toISOString() : null,
  }, { onConflict: 'user_id,device_type' });
}

// ── DeviceCard component ───────────────────────────────────────────────────────

function DeviceCard({
  device, status, lastSyncAt,
  onConnect, onDisconnect, onSync, busy,
}: {
  device:      DeviceInfo;
  status:      ConnectionStatus;
  lastSyncAt:  string | null;
  onConnect:   () => void;
  onDisconnect:() => void;
  onSync:      () => void;
  busy:        boolean;
}) {
  const isConnected   = status === 'connected';
  const isUnavailable = status === 'unavailable';
  const isLoading     = status === 'loading';

  return (
    <View style={[
      ss.card,
      isConnected && ss.cardConnected,
      isUnavailable && ss.cardUnavailable,
    ]}>
      {/* Row 1 — logo + name + pill */}
      <View style={ss.cardHeader}>
        <View style={[ss.logo, isConnected && ss.logoConnected]}>
          <Text style={ss.logoEmoji}>{device.logo}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={ss.nameRow}>
            <Text style={ss.deviceName}>{device.name}</Text>
            {device.iosOnly && Platform.OS !== 'ios' && (
              <View style={ss.iosPill}>
                <Text style={ss.iosPillText}>iOS</Text>
              </View>
            )}
            {isConnected && (
              <View style={ss.connectedPill}>
                <Text style={ss.connectedPillText}>✓ Connected</Text>
              </View>
            )}
          </View>
          <Text style={ss.deviceDesc}>{device.description}</Text>
        </View>
      </View>

      {/* Row 2 — sync info + buttons */}
      <View style={ss.cardFooter}>
        <View>
          {isLoading ? (
            <ActivityIndicator size="small" color={C.muted} />
          ) : isConnected ? (
            <Text style={ss.syncTime}>{formatSyncTime(lastSyncAt)}</Text>
          ) : isUnavailable ? (
            <Text style={ss.unavailableText}>Not available on this device</Text>
          ) : (
            <Text style={ss.notConnected}>Not connected</Text>
          )}
        </View>

        <View style={ss.btnRow}>
          {isConnected && (
            <>
              {device.iosOnly && (
                <Pressable
                  style={ss.iconBtn}
                  onPress={onSync}
                  disabled={busy}
                >
                  {busy
                    ? <ActivityIndicator size="small" color={C.muted} />
                    : <Text style={ss.iconBtnText}>↻</Text>
                  }
                </Pressable>
              )}
              <Pressable
                style={ss.disconnectBtn}
                onPress={onDisconnect}
                disabled={busy}
              >
                {busy
                  ? <ActivityIndicator size="small" color={C.red} />
                  : <Text style={ss.disconnectBtnText}>✕</Text>
                }
              </Pressable>
            </>
          )}
          {!isConnected && !isUnavailable && !isLoading && (
            <Pressable
              style={[ss.connectBtn, busy && ss.connectBtnBusy]}
              onPress={onConnect}
              disabled={busy}
            >
              {busy
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={ss.connectBtnText}>Connect</Text>
              }
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function ConnectedDevicesScreen() {
  const navigation = useNavigation();

  // Apple Health
  const [ahStatus,   setAhStatus]   = useState<ConnectionStatus>('loading');
  const [ahLastSync, setAhLastSync] = useState<string | null>(null);
  const [ahBusy,     setAhBusy]     = useState(false);

  // OAuth devices
  const [oauthStatus,   setOauthStatus]   = useState<Record<string, ConnectionStatus>>({});
  const [oauthLastSync, setOauthLastSync] = useState<Record<string, string | null>>({});
  const [oauthBusy,     setOauthBusy]     = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Load Apple Health status
  const loadAppleHealth = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      setAhStatus('unavailable');
      return;
    }
    const conn = await getAppleHealthConnection();
    setAhStatus(conn.status);
    setAhLastSync(conn.lastSyncAt);
  }, []);

  // Load OAuth connections
  const loadOAuthConnections = useCallback(async () => {
    const keys: DeviceKey[] = ['garmin', 'coros', 'polar'];
    const results = await Promise.all(keys.map(k => getOAuthConnection(k)));
    const statusMap: Record<string, ConnectionStatus> = {};
    const syncMap:   Record<string, string | null>    = {};
    keys.forEach((k, i) => {
      statusMap[k] = results[i].status;
      syncMap[k]   = results[i].lastSyncAt;
    });
    setOauthStatus(statusMap);
    setOauthLastSync(syncMap);
  }, []);

  useEffect(() => {
    loadAppleHealth();
    loadOAuthConnections();
  }, [loadAppleHealth, loadOAuthConnections]);

  // Listen for OAuth deep link callback: runivo://settings/devices?provider=X&code=Y
  useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      const url = event.url;
      if (!url.includes('settings/devices')) return;

      const parsed = new URL(url.replace('runivo://', 'https://runivo.app/'));
      const provider      = parsed.searchParams.get('provider');
      const code          = parsed.searchParams.get('code') ?? undefined;
      const oauthToken    = parsed.searchParams.get('oauth_token') ?? undefined;
      const oauthVerifier = parsed.searchParams.get('oauth_verifier') ?? undefined;
      const error         = parsed.searchParams.get('error');

      if (!provider || provider === 'apple_health') return;

      if (error) {
        showToast(`Failed to connect ${provider}`);
        return;
      }

      if (code || (oauthToken && oauthVerifier)) {
        setOauthBusy(provider);
        try {
          await completeOAuthCallback(provider, { code, oauth_token: oauthToken, oauth_verifier: oauthVerifier });
          await loadOAuthConnections();
          showToast(`${provider.charAt(0).toUpperCase() + provider.slice(1)} connected!`);
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Connection failed');
        } finally {
          setOauthBusy(null);
        }
      }
    };

    const sub = Linking.addEventListener('url', handleUrl);
    // Also check initial URL in case app was opened from OAuth redirect
    Linking.getInitialURL().then(url => {
      if (url) handleUrl({ url });
    });
    return () => sub.remove();
  }, [loadOAuthConnections]);

  // ── Apple Health handlers ───────────────────────────────────────────────────
  const handleAhConnect = async () => {
    setAhBusy(true);
    try {
      // Attempt to read workouts — this triggers the HealthKit permission dialog
      await readRecentWorkouts(1);
      await saveAppleHealthConnection(true);
      await loadAppleHealth();
      showToast('Apple Health connected!');
    } catch (err) {
      Alert.alert('Apple Health', 'Could not connect to Apple Health. Make sure you grant permission in Settings > Privacy > Health.');
    } finally {
      setAhBusy(false);
    }
  };

  const handleAhDisconnect = async () => {
    setAhBusy(true);
    await saveAppleHealthConnection(false);
    setAhStatus('disconnected');
    setAhLastSync(null);
    setAhBusy(false);
  };

  const handleAhSync = async () => {
    setAhBusy(true);
    try {
      await readRecentWorkouts(30);
      await saveAppleHealthConnection(true);
      await loadAppleHealth();
      showToast('Synced with Apple Health');
    } catch {
      showToast('Sync failed');
    } finally {
      setAhBusy(false);
    }
  };

  // ── OAuth handlers ──────────────────────────────────────────────────────────
  const handleOAuthConnect = async (device: DeviceInfo) => {
    if (!device.oauthProvider) return;
    setOauthBusy(device.key);
    try {
      const authUrl = await getOAuthAuthUrl(device.oauthProvider);
      await Linking.openURL(authUrl);
      // The deep link listener will handle the callback
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to open browser');
      setOauthBusy(null);
    }
  };

  const handleOAuthDisconnect = async (device: DeviceInfo) => {
    if (!device.oauthProvider) return;
    setOauthBusy(device.key);
    try {
      await disconnectOAuth(device.oauthProvider);
      await loadOAuthConnections();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setOauthBusy(null);
    }
  };

  return (
    <SafeAreaView style={ss.root}>
      {/* Header */}
      <View style={ss.header}>
        <Pressable onPress={() => navigation.goBack()} style={ss.backBtn}>
          <Text style={ss.backText}>←</Text>
        </Pressable>
        <Text style={ss.title}>Connected Devices</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={ss.scroll}
      >
        {/* Info banner */}
        <View style={ss.banner}>
          <Text style={ss.bannerEmoji}>📱</Text>
          <Text style={ss.bannerText}>
            Connect your fitness devices to automatically import runs, heart rate, cadence and HRV. Existing Runivo runs are never duplicated.
          </Text>
        </View>

        {/* Device cards */}
        {DEVICES.map(device => {
          if (device.key === 'apple_health') {
            return (
              <DeviceCard
                key={device.key}
                device={device}
                status={ahStatus}
                lastSyncAt={ahLastSync}
                onConnect={handleAhConnect}
                onDisconnect={handleAhDisconnect}
                onSync={handleAhSync}
                busy={ahBusy}
              />
            );
          }
          return (
            <DeviceCard
              key={device.key}
              device={device}
              status={oauthStatus[device.key] ?? 'disconnected'}
              lastSyncAt={oauthLastSync[device.key] ?? null}
              onConnect={() => handleOAuthConnect(device)}
              onDisconnect={() => handleOAuthDisconnect(device)}
              onSync={() => {}}
              busy={oauthBusy === device.key}
            />
          );
        })}

        {/* Data types info */}
        <View style={ss.dataCard}>
          <Text style={ss.dataCardTitle}>DATA SYNCED FROM DEVICES</Text>
          {[
            ['❤️', 'Heart rate',  'Avg & max HR per run'],
            ['🏃', 'Cadence',     'Steps/min for gait analysis'],
            ['📈', 'Elevation',   'Total climb per activity'],
            ['🧠', 'HRV',         'Recovery score for AI coach'],
          ].map(([emoji, label, desc]) => (
            <View key={label} style={ss.dataRow}>
              <Text style={ss.dataEmoji}>{emoji}</Text>
              <Text style={ss.dataDesc}>
                <Text style={ss.dataLabel}>{label}</Text>{' — '}{desc}
              </Text>
            </View>
          ))}
        </View>

        <Text style={ss.privacyNote}>
          Runivo never shares your health data with third parties.
        </Text>
      </ScrollView>

      {/* Toast */}
      {toast !== null && (
        <View style={ss.toast}>
          <Text style={ss.toastText}>{toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const ss = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 12 : 0,
    paddingBottom: 12,
  },
  backBtn:  { width: 32 },
  backText: { fontFamily: 'Barlow_400Regular', fontSize: 18, color: C.mid },
  title:    { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: C.ink },
  scroll:   { paddingHorizontal: 16, paddingBottom: 40 },

  banner: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: C.purpleLo,
    borderWidth: 0.5, borderColor: 'rgba(90,58,138,0.2)',
    borderRadius: 12, padding: 14, marginBottom: 16,
  },
  bannerEmoji: { fontSize: 15, marginTop: 1 },
  bannerText:  { flex: 1, fontFamily: 'Barlow_300Light', fontSize: 12, color: C.purple, lineHeight: 18 },

  card: {
    backgroundColor: C.white, borderRadius: 12,
    borderWidth: 0.5, borderColor: C.border,
    padding: 14, marginBottom: 10,
  },
  cardConnected:   { borderColor: 'rgba(26,107,64,0.3)' },
  cardUnavailable: { opacity: 0.6 },

  cardHeader:   { flexDirection: 'row', gap: 12, marginBottom: 10 },
  logo: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: C.bg, borderWidth: 0.5, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  logoConnected:  { backgroundColor: C.greenLo },
  logoEmoji:      { fontSize: 20 },

  nameRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  deviceName:  { fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.ink },
  deviceDesc:  { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.muted },

  iosPill:     { backgroundColor: '#F0F0F0', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  iosPillText: { fontFamily: 'Barlow_500Medium', fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6 },

  connectedPill:     { backgroundColor: C.greenLo, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  connectedPillText: { fontFamily: 'Barlow_500Medium', fontSize: 9, color: C.green, textTransform: 'uppercase', letterSpacing: 0.6 },

  cardFooter:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  syncTime:      { fontFamily: 'Barlow_400Regular', fontSize: 10, color: C.green },
  notConnected:  { fontFamily: 'Barlow_400Regular', fontSize: 10, color: C.muted },
  unavailableText: { fontFamily: 'Barlow_400Regular', fontSize: 10, color: C.muted },

  btnRow:        { flexDirection: 'row', gap: 6 },
  iconBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: C.bg, borderWidth: 0.5, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnText: { fontFamily: 'Barlow_400Regular', fontSize: 16, color: C.mid },

  disconnectBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: C.redLo, borderWidth: 0.5, borderColor: 'rgba(217,53,24,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  disconnectBtnText: { fontFamily: 'Barlow_400Regular', fontSize: 13, color: C.red },

  connectBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    backgroundColor: C.ink,
  },
  connectBtnBusy: { backgroundColor: C.border },
  connectBtnText: { fontFamily: 'Barlow_500Medium', fontSize: 11, color: '#fff' },

  dataCard: {
    backgroundColor: C.white, borderRadius: 12,
    borderWidth: 0.5, borderColor: C.border,
    padding: 14, marginTop: 4,
  },
  dataCardTitle: {
    fontFamily: 'Barlow_500Medium', fontSize: 10,
    textTransform: 'uppercase', letterSpacing: 0.8,
    color: C.muted, marginBottom: 8,
  },
  dataRow:   { flexDirection: 'row', gap: 8, marginBottom: 6 },
  dataEmoji: { fontSize: 13 },
  dataLabel: { fontFamily: 'Barlow_500Medium', fontSize: 11, color: C.ink },
  dataDesc:  { flex: 1, fontFamily: 'Barlow_300Light', fontSize: 11, color: C.mid, lineHeight: 16 },

  privacyNote: {
    fontFamily: 'Barlow_300Light', fontSize: 10,
    color: C.muted, textAlign: 'center', marginTop: 12,
  },

  toast: {
    position: 'absolute', bottom: 40,
    alignSelf: 'center',
    backgroundColor: C.ink, borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 8,
  },
  toastText: { fontFamily: 'Barlow_500Medium', fontSize: 12, color: '#fff' },
});
