/**
 * ToastProvider — wraps the app root and renders a single toast at a time.
 * Toasts are queued; each one auto-dismisses after `duration` ms.
 *
 * Place this outside <NavigationContainer> so any screen/hook can call useToast().
 */
import React, {
  useState, useRef, useCallback, useEffect, type ReactNode,
} from 'react';
import { Animated, Text, StyleSheet, Platform, View } from 'react-native';
import { Check, X, AlertTriangle, Info } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ToastContext,
  type ToastOptions,
  type ToastType,
} from '../hooks/useToast';

// ─── Colours per toast type ──────────────────────────────────────────────────
const BG: Record<ToastType, string> = {
  success: '#1A6B40',
  error:   '#C0392B',
  warning: '#9E6800',
  info:    '#0A0A0A',
};

const ICON_COMPONENTS: Record<ToastType, React.FC<{ size: number; color: string; strokeWidth: number }>> = {
  success: Check,
  error:   X,
  warning: AlertTriangle,
  info:    Info,
};

// ─── Component ───────────────────────────────────────────────────────────────
interface ActiveToast extends Required<ToastOptions> {
  id: number;
}

let _nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent]     = useState<ActiveToast | null>(null);
  const queueRef                  = useRef<ActiveToast[]>([]);
  const isShowingRef              = useRef(false);
  const translateY                = useRef(new Animated.Value(-80)).current;
  const opacity                   = useRef(new Animated.Value(0)).current;
  const dismissTimerRef           = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    Animated.parallel([
      Animated.timing(translateY, { toValue: -80, duration: 220, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 0,   duration: 220, useNativeDriver: true }),
    ]).start(() => {
      isShowingRef.current = false;
      setCurrent(null);
      // Show next toast in queue
      if (queueRef.current.length > 0) {
        const next = queueRef.current.shift()!;
        showItem(next);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showItem = useCallback((item: ActiveToast) => {
    isShowingRef.current = true;
    setCurrent(item);
    translateY.setValue(-80);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }),
      Animated.timing(opacity,    { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    dismissTimerRef.current = setTimeout(dismiss, item.duration);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismiss]);

  const showToast = useCallback((options: ToastOptions) => {
    const item: ActiveToast = {
      id:       _nextId++,
      message:  options.message,
      type:     options.type    ?? 'info',
      duration: options.duration ?? 3500,
    };
    if (isShowingRef.current) {
      // Limit queue depth to 3 to avoid stale pileups
      if (queueRef.current.length < 3) queueRef.current.push(item);
    } else {
      showItem(item);
    }
  }, [showItem]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
  }, []);

  const topOffset = insets.top + (Platform.OS === 'ios' ? 12 : 16);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {current !== null && (
        <Animated.View
          pointerEvents="none"
          style={[
            ss.toast,
            { backgroundColor: BG[current.type], top: topOffset },
            { opacity, transform: [{ translateY }] },
          ]}
        >
          <View style={ss.iconWrap}>{React.createElement(ICON_COMPONENTS[current.type], { size: 14, color: '#FFFFFF', strokeWidth: 2 })}</View>
          <Text style={ss.message} numberOfLines={2}>{current.message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  toast: {
    position:         'absolute',
    left:             16,
    right:            16,
    flexDirection:    'row',
    alignItems:       'center',
    gap:              10,
    borderRadius:     14,
    paddingVertical:  12,
    paddingHorizontal: 16,
    zIndex:           9999,
    // Shadow
    shadowColor:      '#000',
    shadowOffset:     { width: 0, height: 4 },
    shadowOpacity:    0.22,
    shadowRadius:     8,
    elevation:        8,
  },
  iconWrap: {
    width:           16,
    alignItems:      'center',
    justifyContent:  'center',
  },
  message: {
    fontFamily: 'Barlow_500Medium',
    fontSize:   13,
    color:      '#FFFFFF',
    flex:       1,
    lineHeight: 18,
  },
});
