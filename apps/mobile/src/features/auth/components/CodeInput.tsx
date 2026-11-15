import React, { useRef, useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onComplete: (v: string) => void;
  error?: boolean;
  autoFocus?: boolean;
}

/** Six boxes over one hidden field, so SMS autofill and paste just work. */
export default function CodeInput({ value, onChange, onComplete, error, autoFocus = true }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const ref = useRef<TextInput>(null);

  const handle = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    onChange(digits);
    if (digits.length === 6) onComplete(digits);
  };

  return (
    <Pressable onPress={() => ref.current?.focus()} accessibilityLabel="6-digit code" accessibilityHint="Enter the code we sent you">
      <View style={s.row}>
        {Array.from({ length: 6 }).map((_, i) => {
          const ch = value[i] ?? '';
          const active = i === Math.min(value.length, 5);
          return (
            <View key={i} style={[s.box, active && s.boxActive, error && value.length === 6 && s.boxError]}>
              <Text style={s.digit}>{ch}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={handle}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        // No maxLength: it would cut "123 456" / "123-456" (paste, autofill) to 5 digits before
        // `handle` strips the separators and slices to 6 itself.
        accessibilityLabel="6-digit code"
        autoFocus={autoFocus}
        style={s.hidden}
        caretHidden
      />
    </Pressable>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    row:       { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
    box:       {
      flex: 1, height: 60, borderRadius: 14, backgroundColor: C.card,
      borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center',
    },
    boxActive: { borderColor: C.t1 },
    boxError:  { borderColor: C.red },
    digit:     { fontFamily: Fonts.numeric, fontSize: 30, color: C.t1, fontVariant: ['tabular-nums'] },
    hidden:    { position: 'absolute', width: 1, height: 1, opacity: 0 },
  });
}
