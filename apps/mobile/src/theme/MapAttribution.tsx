/**
 * The visible map credit (OpenStreetMap data, CARTO tiles). OSM's licence and
 * CARTO's terms require it wherever a map is shown, so every MapView in the
 * app renders this over the map. Tapping opens the OSM copyright page.
 */
import React from 'react';
import { Linking, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { MAP_ATTRIBUTION, MAP_ATTRIBUTION_URL } from './maps';

export function MapAttribution({ style }: { style?: ViewStyle }) {
  return (
    <Pressable
      style={[ss.wrap, style]}
      onPress={() => { Linking.openURL(MAP_ATTRIBUTION_URL).catch(() => {}); }}
      accessibilityRole="link"
      accessibilityLabel="Map data © OpenStreetMap contributors, map tiles © CARTO"
      hitSlop={6}
    >
      <Text style={ss.txt}>{MAP_ATTRIBUTION}</Text>
    </Pressable>
  );
}

const ss = StyleSheet.create({
  wrap: { position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.75)' },
  txt:  { fontSize: 9.5, color: '#333333' },
});
