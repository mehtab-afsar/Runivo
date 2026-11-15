/**
 * iOS Live Activity for a run (PRD L2): lock screen and Dynamic Island show
 * distance, time and pace. Rendered by expo-widgets in the widget extension:
 * the layout function (marked 'widget') is serialized, so it may only use its
 * props and the SwiftUI components/modifiers, nothing else from this file.
 *
 * Load this module only through runLiveActivity.ts (it checks the build has
 * expo-widgets first).
 */
import { Text, VStack, HStack, Spacer } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding, monospacedDigit } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

export interface RunActivityProps {
  /** "Run", "Ride"… */
  sport: string;
  /** "5.24" */
  distance: string;
  /** "km" */
  unit: string;
  /** "28:41" */
  time: string;
  /** "5:28 /km" or "24.1 km/h" */
  pace: string;
  /** "Recording", "Paused", "Loop closing", "Rep 2 of 5" */
  status: string;
}

const RunActivity = (props: RunActivityProps) => {
  'widget';
  return {
    banner: (
      <HStack spacing={16} modifiers={[padding({ all: 16 })]}>
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle('#C9F06B')]}>{`${props.sport.toUpperCase()} · ${props.status}`}</Text>
          <HStack spacing={4}>
            <Text modifiers={[font({ size: 34, weight: 'bold', design: 'rounded' }), monospacedDigit()]}>{props.distance}</Text>
            <Text modifiers={[font({ size: 15, weight: 'medium' }), foregroundStyle('#8E8E93')]}>{props.unit}</Text>
          </HStack>
        </VStack>
        <Spacer />
        <VStack alignment="trailing" spacing={4}>
          <Text modifiers={[font({ size: 20, weight: 'semibold', design: 'rounded' }), monospacedDigit()]}>{props.time}</Text>
          <Text modifiers={[font({ size: 14, weight: 'medium' }), foregroundStyle('#8E8E93'), monospacedDigit()]}>{props.pace}</Text>
        </VStack>
      </HStack>
    ),
    compactLeading: <Text modifiers={[font({ size: 14, weight: 'semibold' }), monospacedDigit()]}>{`${props.distance} ${props.unit}`}</Text>,
    compactTrailing: <Text modifiers={[font({ size: 14, weight: 'semibold' }), monospacedDigit(), foregroundStyle('#C9F06B')]}>{props.time}</Text>,
    minimal: <Text modifiers={[font({ size: 12, weight: 'bold' }), monospacedDigit()]}>{props.distance}</Text>,
    expandedLeading: (
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle('#C9F06B')]}>{props.sport.toUpperCase()}</Text>
        <Text modifiers={[font({ size: 28, weight: 'bold', design: 'rounded' }), monospacedDigit()]}>{`${props.distance} ${props.unit}`}</Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack alignment="trailing" spacing={2}>
        <Text modifiers={[font({ size: 20, weight: 'semibold', design: 'rounded' }), monospacedDigit()]}>{props.time}</Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle('#8E8E93'), monospacedDigit()]}>{props.pace}</Text>
      </VStack>
    ),
    expandedBottom: <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle('#8E8E93')]}>{props.status}</Text>,
  };
};

export const runActivity = createLiveActivity<RunActivityProps>('RunActivity', RunActivity);
