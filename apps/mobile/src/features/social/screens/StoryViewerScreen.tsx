import React from 'react';
import {
  View, Image, StyleSheet, Pressable, Text, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useStoryViewer } from '@features/social/hooks/useStoryViewer';
import { StoryProgress } from '@features/social/components/StoryProgress';
import { StoryOverlay } from '@features/social/components/StoryOverlay';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'StoryViewer'>;

export default function StoryViewerScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const insets     = useSafeAreaInsets();

  const { groups, initialGroupIndex = 0 } = route.params;

  const { currentGroup, storyIdx, progress, next, prev, pause, resume, close } =
    useStoryViewer(groups, initialGroupIndex, () => navigation.goBack());

  const currentStory = currentGroup?.stories[storyIdx];

  if (!currentGroup || !currentStory) return null;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      <Image source={{ uri: currentStory.imageUrl }} style={s.image} resizeMode="contain" />
      <View style={s.topGradient} />

      <View style={[s.progressRow, { top: insets.top + 8 }]}>
        <StoryProgress count={currentGroup.stories.length} currentIndex={storyIdx} progress={progress} />
      </View>

      <StoryOverlay group={currentGroup} storyIndex={storyIdx} topOffset={insets.top} />

      <Pressable style={[s.closeBtn, { top: insets.top + 24 }]} onPress={close}>
        <Text style={s.closeIcon}>✕</Text>
      </Pressable>

      <View style={s.tapRow}>
        <Pressable
          style={{ flex: 1 }}
          onPressIn={pause}
          onPressOut={() => { resume(); prev(); }}
        />
        <Pressable
          style={{ flex: 1 }}
          onPressIn={pause}
          onPressOut={() => { resume(); next(); }}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#000' },
  image:       { ...StyleSheet.absoluteFillObject },
  topGradient: { ...StyleSheet.absoluteFillObject, height: 160, backgroundColor: 'rgba(0,0,0,0.35)', bottom: undefined },
  progressRow: { position: 'absolute', left: 12, right: 12, zIndex: 10 },
  closeBtn:    { position: 'absolute', right: 16, zIndex: 15, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  closeIcon:   { color: '#fff', fontSize: 14 },
  tapRow:      { ...StyleSheet.absoluteFillObject, flexDirection: 'row', zIndex: 5, top: 80 },
});
