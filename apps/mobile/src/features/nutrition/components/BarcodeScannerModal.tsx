import React, { useState, useCallback } from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X, Barcode } from 'phosphor-react-native';
import { Colors, Fonts } from '@theme';
import { lookupBarcode, type ScannedFood } from '@features/nutrition/services/foodScanService';

interface BarcodeScannerModalProps {
  visible:  boolean;
  onResult: (food: ScannedFood) => void;
  onClose:  () => void;
}

export function BarcodeScannerModal({ visible, onResult, onClose }: BarcodeScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning,  setScanning]        = useState(true);
  const [looking,   setLooking]         = useState(false);

  const handleScan = useCallback(async ({ data: barcode }: { data: string }) => {
    if (!scanning || looking) return;
    setScanning(false);
    setLooking(true);

    const food = await lookupBarcode(barcode);
    setLooking(false);

    if (food) {
      onResult(food);
    } else {
      Alert.alert(
        'Not found',
        'This product isn\'t in our database yet. Enter details manually.',
        [
          { text: 'Try again', onPress: () => setScanning(true) },
          { text: 'Enter manually', style: 'cancel', onPress: onClose },
        ],
      );
    }
  }, [scanning, looking, onResult, onClose]);

  if (!visible) return null;

  // Request permission if not determined
  if (!permission) {
    return (
      <Modal visible animationType="slide" onRequestClose={onClose}>
        <SafeAreaView style={s.root}>
          <ActivityIndicator color={Colors.alwaysLight} />
        </SafeAreaView>
      </Modal>
    );
  }

  if (!permission.granted) {
    return (
      <Modal visible animationType="slide" onRequestClose={onClose}>
        <SafeAreaView style={s.root}>
          <Text style={s.permText}>Camera access needed to scan barcodes.</Text>
          <Pressable style={s.permBtn} onPress={requestPermission}>
            <Text style={s.permBtnLabel}>Allow Camera</Text>
          </Pressable>
          <Pressable onPress={onClose} style={s.closeTopBtn}>
            <X size={20} color={Colors.alwaysLight} weight="regular" />
          </Pressable>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'upc_a', 'ean8', 'code128', 'qr', 'upc_e'] }}
          onBarcodeScanned={scanning ? handleScan : undefined}
        />

        {/* Overlay UI */}
        <SafeAreaView style={s.overlay}>
          {/* Top bar */}
          <View style={s.topBar}>
            <Pressable onPress={onClose} style={s.closeTopBtn}>
              <X size={20} color={Colors.alwaysLight} weight="regular" />
            </Pressable>
            <Text style={s.topTitle}>Scan Barcode</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Targeting reticle */}
          <View style={s.reticleWrap}>
            <View style={s.reticle}>
              <View style={[s.corner, s.tl]} />
              <View style={[s.corner, s.tr]} />
              <View style={[s.corner, s.bl]} />
              <View style={[s.corner, s.br]} />
              {looking && (
                <View style={s.lookingOverlay}>
                  <ActivityIndicator color={Colors.alwaysLight} size="large" />
                  <Text style={s.lookingText}>Looking up product…</Text>
                </View>
              )}
            </View>
            <View style={s.scanLine} />
          </View>

          {/* Bottom hint */}
          <View style={s.bottomHint}>
            <Barcode size={20} color="rgba(255,255,255,0.6)" weight="regular" />
            <Text style={s.hintText}>Point at a product barcode</Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const RETICLE_W = 260;
const RETICLE_H = 160;
const CORNER    = 20;
const THICK     = 3;

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#000' },
  overlay:     { flex: 1 },
  topBar:      {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8,
  },
  closeTopBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle:    { color: Colors.alwaysLight, fontFamily: Fonts.semiBold, fontSize: 16 },

  reticleWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  reticle:     {
    width: RETICLE_W, height: RETICLE_H,
    borderRadius: 4,
    overflow: 'hidden',
  },
  corner:      { position: 'absolute', width: CORNER, height: CORNER, borderColor: Colors.alwaysLight },
  tl:          { top: 0, left: 0,  borderTopWidth: THICK, borderLeftWidth: THICK  },
  tr:          { top: 0, right: 0, borderTopWidth: THICK, borderRightWidth: THICK },
  bl:          { bottom: 0, left: 0,  borderBottomWidth: THICK, borderLeftWidth: THICK  },
  br:          { bottom: 0, right: 0, borderBottomWidth: THICK, borderRightWidth: THICK },

  scanLine:    {
    position: 'absolute', width: RETICLE_W - 20, height: 1.5,
    backgroundColor: 'rgba(217,53,24,0.8)',
    alignSelf: 'center',
  },

  lookingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  lookingText:    { color: Colors.alwaysLight, fontFamily: Fonts.medium, fontSize: 13 },

  bottomHint:     {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingBottom: 24,
  },
  hintText:       { color: 'rgba(255,255,255,0.6)', fontFamily: Fonts.regular, fontSize: 13 },

  // permission screen
  permText:    { color: Colors.alwaysLight, fontFamily: Fonts.regular, fontSize: 15, textAlign: 'center', margin: 32 },
  permBtn:     {
    backgroundColor: '#D93518', borderRadius: 10, paddingVertical: 14,
    paddingHorizontal: 28, alignSelf: 'center',
  },
  permBtnLabel: { color: Colors.alwaysLight, fontFamily: Fonts.semiBold, fontSize: 15 },
});
