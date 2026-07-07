import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, Pressable, Modal, Animated, Easing, StyleSheet } from 'react-native';
import { useTheme, Fonts } from '@theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  awards: string[];
}

const PARTICLE_COUNT = 24;
const PARTICLE_COLORS = ['#C8391A', '#FFD60A', '#FFFFFF', '#FF453A', '#FF9F0A'];

interface Particle {
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  color: string;
}

function createParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    x:       new Animated.Value(0),
    y:       new Animated.Value(0),
    opacity: new Animated.Value(0),
    scale:   new Animated.Value(0),
    color:   PARTICLE_COLORS[i % PARTICLE_COLORS.length],
  }));
}

function burst(particles: Particle[]) {
  particles.forEach((p, i) => {
    const angle    = (i / PARTICLE_COUNT) * Math.PI * 2;
    const distance = 60 + Math.random() * 80;
    const tx       = Math.cos(angle) * distance;
    const ty       = Math.sin(angle) * distance - 40;
    const dur      = 800 + Math.random() * 400;

    p.x.setValue(0);
    p.y.setValue(0);
    p.opacity.setValue(1);
    p.scale.setValue(0.3 + Math.random() * 0.7);

    Animated.parallel([
      Animated.timing(p.x,       { toValue: tx,        duration: dur,       easing: Easing.out(Easing.quad),  useNativeDriver: true }),
      Animated.timing(p.y,       { toValue: ty + 60,   duration: dur + 200, easing: Easing.in(Easing.quad),   useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(p.opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  });
}

export default function AwardUnlockSheet({ visible, onClose, awards }: Props) {
  const C = useTheme();

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const cardScale      = useRef(new Animated.Value(0.7)).current;
  const iconScale      = useRef(new Animated.Value(0)).current;
  const particles      = useMemo(() => createParticles(), []);

  useEffect(() => {
    if (!visible) return;

    overlayOpacity.setValue(0);
    cardScale.setValue(0.7);
    iconScale.setValue(0);

    Animated.timing(overlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    Animated.spring(cardScale, { toValue: 1, damping: 16, stiffness: 220, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.spring(iconScale, { toValue: 1, damping: 10, stiffness: 200, useNativeDriver: true }).start();
    }, 150);
    setTimeout(() => burst(particles), 300);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayAward = awards[0] ?? '🏆';

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[ss.overlay, { opacity: overlayOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View style={[ss.card, { backgroundColor: C.surface, transform: [{ scale: cardScale }] }]}>
          {/* Particles */}
          <View style={ss.particleContainer} pointerEvents="none">
            {particles.map((p, i) => (
              <Animated.View
                key={i}
                style={[ss.particle, {
                  backgroundColor: p.color,
                  opacity: p.opacity,
                  transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.scale }],
                }]}
              />
            ))}
          </View>

          <Animated.Text style={[ss.icon, { transform: [{ scale: iconScale }] }]}>
            {displayAward}
          </Animated.Text>

          <Text style={[ss.title, { color: C.black }]}>Award Unlocked</Text>
          <Text style={[ss.sub, { color: C.t2 }]}>
            {awards.length > 1
              ? `${awards.length} new awards earned on this run`
              : 'New award earned on this run'}
          </Text>

          <Pressable style={[ss.btn, { backgroundColor: C.red }]} onPress={onClose}>
            <Text style={ss.btnTxt}>Nice!</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const ss = StyleSheet.create({
  overlay:           { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  card:              { width: 300, borderRadius: 14, padding: 28, alignItems: 'center' },
  particleContainer: { position: 'absolute', top: '40%', left: '50%', width: 0, height: 0 },
  particle:          { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
  icon:              { fontSize: 56, marginBottom: 16 },
  title:             { fontFamily: Fonts.semiBold, fontSize: 20, marginBottom: 8 },
  sub:               { fontFamily: Fonts.regular, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  btn:               { borderRadius: 12, paddingVertical: 13, paddingHorizontal: 40 },
  btnTxt:            { fontFamily: Fonts.semiBold, fontSize: 15, color: '#FFFFFF' },
});
