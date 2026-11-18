/**
 * Share profile, Snapchat style: a full-screen lime page with your card
 * (photo, name, numbers, QR). Share it as an image, send the link, or scan a
 * friend's code to open their profile.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, Share, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { X, Scan, Export, LinkSimple, CaretLeft } from 'phosphor-react-native';
import { Fonts } from '@theme';
import { appAlert, AlertLayer } from '@mobile/shared/components/AppAlert';
import { PngCapture, type PngCaptureHandle } from '@features/run/components/PngCapture';
import {
  buildProfileCardSvg, buildProfileStorySvg, profileLink, runnerIdFromLink,
  CARD_W, CARD_H, STORY_W, STORY_H, PHOTO_CY, PHOTO_R, type ProfileCardData,
} from '../services/profileCard';

const INK = '#17181A', LIME = '#C9F06B';

/** The photo as a data URI, so the SVG (and the exported PNG) can draw it. */
async function photoDataUri(uri: string | null | undefined): Promise<string | null> {
  if (!uri) return null;
  try {
    let local = uri;
    if (/^https?:/i.test(uri)) {
      const dest = `${FileSystem.cacheDirectory}share_avatar_${uri.length}_${uri.slice(-12).replace(/\W/g, '')}`;
      local = (await FileSystem.downloadAsync(uri, dest)).uri;
    }
    const b64 = await FileSystem.readAsStringAsync(local, { encoding: FileSystem.EncodingType.Base64 });
    const mime = /\.png(\?|$)/i.test(uri) ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${b64}`;
  } catch {
    return null;
  }
}

export interface ShareProfileParams {
  userId: string; name: string; username?: string | null; rank: string;
  runs: number; km: number; zones: number; avatarUri?: string | null;
}

/**
 * A screen in the app's stack, not a Modal: it presents the iPhone share sheet,
 * and a Modal presenting the share sheet could leave iOS believing a Modal was
 * still up, after which no sheet in the app would open.
 */
export default function ShareProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const params = useRoute<RouteProp<RootStackParamList, 'ShareProfile'>>().params;
  return (
    <>
      <SharePage
        {...params}
        onClose={() => navigation.goBack()}
        onOpenRunner={id => navigation.replace('UserProfile', { userId: id })}
      />
      <AlertLayer />
    </>
  );
}

function SharePage(p: ShareProfileParams & { onClose: () => void; onOpenRunner: (userId: string) => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [photo, setPhoto] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const captureRef = useRef<PngCaptureHandle>(null);

  useEffect(() => { let live = true; photoDataUri(p.avatarUri).then(d => { if (live) setPhoto(d); }); return () => { live = false; }; }, [p.avatarUri]);

  const link = profileLink(p.userId, p.username);
  const data: ProfileCardData = useMemo(() => ({
    name: p.name, username: p.username, rank: p.rank, runs: p.runs, km: p.km, zones: p.zones, link, photo,
  }), [p.name, p.username, p.rank, p.runs, p.km, p.zones, link, photo]);
  // On screen the photo is a native image over the card (sharp, and shown as soon as it loads);
  // the exported PNG draws it inside the SVG.
  const cardXml = useMemo(() => buildProfileCardSvg({ ...data, photo: null }), [data]);

  // Fit the card between the top bar and the buttons.
  const maxH = height - insets.top - insets.bottom - 64 - 150;
  const cardW = Math.min(width - 48, CARD_W * 1.15, (maxH * CARD_W) / CARD_H);
  const cardH = (cardW * CARD_H) / CARD_W;
  const k = cardW / CARD_W;

  const shareImage = async () => {
    if (busy || !captureRef.current) return;
    setBusy(true);
    try {
      if (!(await Sharing.isAvailableAsync())) { appAlert('Sharing is not available on this phone'); return; }
      const b64 = await captureRef.current.capture(buildProfileStorySvg(data), { viewWidth: STORY_W, viewHeight: STORY_H, outWidth: 1080, outHeight: 1920 });
      const uri = `${FileSystem.cacheDirectory}runivo_profile.png`;
      await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share your Runivo card' });
    } catch {
      appAlert('Could not make your card', 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const sendLink = () => {
    Share.share({ message: `Follow me on Runivo: ${link}`, url: link }).catch(() => {});
  };

  if (scanning) return <Scanner onBack={() => setScanning(false)} onFound={id => p.onOpenRunner(id)} />;

  return (
    <View style={[s.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={s.top}>
        <Pressable style={s.round} onPress={p.onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8}>
          <X size={20} color={INK} weight="bold" />
        </Pressable>
        <Pressable style={s.scanPill} onPress={() => setScanning(true)} accessibilityRole="button" accessibilityLabel="Scan a friend's code">
          <Scan size={18} color={INK} weight="bold" />
          <Text style={s.scanTxt}>Scan a code</Text>
        </Pressable>
      </View>

      <View style={s.center}>
        <View style={[s.cardShadow, { width: cardW, height: cardH, borderRadius: 34 * (cardW / CARD_W) }]}>
          <SvgXml xml={cardXml} width={cardW} height={cardH} />
          {!!p.avatarUri && (
            <Image
              source={{ uri: p.avatarUri }}
              style={{ position: 'absolute', left: (CARD_W / 2 - PHOTO_R) * k, top: (PHOTO_CY - PHOTO_R) * k, width: PHOTO_R * 2 * k, height: PHOTO_R * 2 * k, borderRadius: PHOTO_R * k }}
              accessibilityIgnoresInvertColors
            />
          )}
        </View>
      </View>

      <View style={s.actions}>
        <Pressable style={[s.btn, s.btnInk]} onPress={shareImage} accessibilityRole="button" disabled={busy}>
          {busy ? <ActivityIndicator color={LIME} /> : <><Export size={20} color={LIME} weight="bold" /><Text style={[s.btnTxt, { color: '#FFFFFF' }]}>Share card</Text></>}
        </Pressable>
        <Pressable style={[s.btn, s.btnWhite]} onPress={sendLink} accessibilityRole="button">
          <LinkSimple size={20} color={INK} weight="bold" />
          <Text style={s.btnTxt}>Send link</Text>
        </Pressable>
      </View>
      <PngCapture ref={captureRef} />
    </View>
  );
}

function Scanner({ onBack, onFound }: { onBack: () => void; onFound: (userId: string) => void }) {
  const insets = useSafeAreaInsets();
  const [perm, requestPerm] = useCameraPermissions();
  const [hint, setHint] = useState<string | null>(null);
  const done = useRef(false);
  const lastBad = useRef('');

  useEffect(() => { if (perm && !perm.granted && perm.canAskAgain) requestPerm(); }, [perm, requestPerm]);

  const onScan = ({ data }: { data: string }) => {
    if (done.current) return;
    const id = runnerIdFromLink(data);
    if (id) {
      done.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onFound(id);
    } else if (data !== lastBad.current) {
      lastBad.current = data;
      setHint('That is not a Runivo code');
    }
  };

  return (
    <View style={[s.scanRoot]}>
      {perm?.granted
        ? <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScan} />
        : (
          <View style={[StyleSheet.absoluteFill, s.permBox]}>
            <Text style={s.permTitle}>Camera needed</Text>
            <Text style={s.permTxt}>Allow camera access in Settings to scan a friend's Runivo code.</Text>
          </View>
        )}
      <View style={[s.scanTop, { paddingTop: insets.top + 8 }]}>
        <Pressable style={[s.round, { backgroundColor: 'rgba(255,255,255,0.92)' }]} onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to my card" hitSlop={8}>
          <CaretLeft size={20} color={INK} weight="bold" />
        </Pressable>
      </View>
      {perm?.granted && (
        <View style={s.frameWrap} pointerEvents="none">
          <View style={s.frame} />
          <Text style={s.frameTxt}>{hint ?? "Point at a friend's Runivo code"}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LIME },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, height: 48 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  scanPill: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.7)' },
  scanTxt: { fontFamily: Fonts.semiBold, fontSize: 15, color: INK },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardShadow: { backgroundColor: '#FFFFFF', shadowColor: '#2E3A10', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 24 },
  btn: { flex: 1, height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnInk: { backgroundColor: INK },
  btnWhite: { backgroundColor: '#FFFFFF' },
  btnTxt: { fontFamily: Fonts.semiBold, fontSize: 16, color: INK },
  scanRoot: { flex: 1, backgroundColor: '#000' },
  scanTop: { position: 'absolute', left: 20, top: 0 },
  permBox: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8, backgroundColor: INK },
  permTitle: { fontFamily: Fonts.semiBold, fontSize: 20, color: '#FFFFFF' },
  permTxt: { fontFamily: Fonts.regular, fontSize: 15, color: '#C9CCC4', textAlign: 'center', lineHeight: 21 },
  frameWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 20 },
  frame: { width: 240, height: 240, borderRadius: 32, borderWidth: 4, borderColor: LIME },
  frameTxt: { fontFamily: Fonts.semiBold, fontSize: 16, color: '#FFFFFF', backgroundColor: 'rgba(23,24,26,0.6)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, overflow: 'hidden' },
});
