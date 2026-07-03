import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Footprints, MapTrifold, Fire, Heart, Lightning, Compass, Sword, Shield, Clock, type Icon } from 'phosphor-react-native';
import type { OnboardingData } from '../types';
import { D, shared } from './onboardingStyles';

type IconComp = Icon;

interface Mission {
  title: string;
  pace: number;
  Icon: IconComp;
}

const MISSIONS: Record<OnboardingData['primaryGoal'], Mission[]> = {
  get_fit:     [{ title: 'Run 3 km', pace: 90, Icon: Footprints }, { title: 'Claim 5 territories', pace: 125, Icon: MapTrifold }, { title: '3-day streak', pace: 150, Icon: Fire }],
  lose_weight: [{ title: 'Burn 300 cal', pace: 90, Icon: Fire }, { title: 'Run 5 km this week', pace: 150, Icon: Footprints }, { title: 'Log a meal', pace: 50, Icon: Heart }],
  run_faster:  [{ title: 'Sub-6 min/km run', pace: 120, Icon: Lightning }, { title: 'Complete a tempo run', pace: 150, Icon: Clock }, { title: 'Beat your last pace', pace: 100, Icon: Sword }],
  explore:     [{ title: 'Visit 3 new streets', pace: 90, Icon: Compass }, { title: 'Claim 10 zones', pace: 150, Icon: MapTrifold }, { title: 'Run a loop route', pace: 100, Icon: Footprints }],
  compete:     [{ title: 'Capture an enemy zone', pace: 150, Icon: Sword }, { title: 'Reach top 10 local', pace: 200, Icon: Lightning }, { title: 'Defend your territory', pace: 120, Icon: Shield }],
};

interface Props {
  primaryGoal: OnboardingData['primaryGoal'];
}

export default function FirstMissionStep({ primaryGoal }: Props) {
  const missions = MISSIONS[primaryGoal];

  const anims = useRef(missions.map(() => ({
    opacity:    new Animated.Value(0),
    translateY: new Animated.Value(16),
  }))).current;

  useEffect(() => {
    Animated.stagger(100, anims.map(({ opacity, translateY }) =>
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: 360, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, damping: 22,   useNativeDriver: true }),
      ])
    )).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={shared.stepContent}>
      <Text style={shared.eyebrow}>First challenge</Text>
      <Text style={shared.heroTitle}>Your first{'\n'}mission.</Text>
      <Text style={shared.subtitle}>Chosen for your goal. Complete it in your first week.</Text>

      <View style={s.rule} />

      {missions.map((m, i) => {
        const { Icon } = m;
        return (
          <Animated.View
            key={m.title}
            style={{ opacity: anims[i].opacity, transform: [{ translateY: anims[i].translateY }] }}
          >
            <View style={s.card}>
              <View style={s.iconWrap}>
                <Icon size={16} color={D.red} weight="light" />
              </View>
              <Text style={s.cardTitle}>{m.title}</Text>
              <View style={s.paceBadge}>
                <Text style={s.paceText}>+{m.pace} PACE</Text>
              </View>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  rule:      { height: 1, backgroundColor: D.div, marginBottom: 0 },
  card:      { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, borderBottomWidth: 0.5, borderBottomColor: D.div },
  iconWrap:  { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(200,57,26,0.08)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardTitle: { fontSize: 14, color: D.t1, flex: 1 },
  paceBadge: { borderRadius: 4, backgroundColor: 'rgba(200,57,26,0.08)', paddingHorizontal: 8, paddingVertical: 3 },
  paceText:  { fontWeight: '500', fontSize: 11, color: D.red },
});
