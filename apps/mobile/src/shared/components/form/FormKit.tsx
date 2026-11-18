/**
 * One look for every "create / add" screen (club, event, challenge, club run,
 * goal, shoe, treadmill run, private place), taken from the mock's onboarding
 * pages (OnbProfile, OnbGoal):
 *
 *   back/close circle · big two-tone title · grey line under it
 *   labelled white fields (1.5pt border, ink when focused)
 *   black pill chips · choice cards (mint + ink border + green tick when on)
 *   lavender PaceX tip · black 56pt button pinned to the bottom
 *
 * FormScreen is a full page (presented as a modal or pushed), never a cramped
 * bottom sheet, so it always sits below the status bar and scrolls with the
 * keyboard up.
 */
import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform,
  StyleSheet, type TextInputProps, type StyleProp, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, CaretLeft, Check } from 'phosphor-react-native';
import { PaceXOrb } from '@mobile/shared/components/PaceXOrb';
import { PrimaryButton } from '@mobile/shared/components/PrimaryButton';
import { TextButton } from '@mobile/shared/components/TextButton';
import { useTheme, Fonts, type AppColors } from '@theme';

type IconType = React.ComponentType<{ size?: number; color?: string; weight?: 'regular' | 'bold' | 'fill' | 'light' }>;

// ── Page ────────────────────────────────────────────────────────────────────

export function FormScreen({
  title, accent, subtitle, onClose, closeIcon = 'close', children, footer,
}: {
  /** First part of the title, in ink. */
  title: string;
  /** Last word(s) of the title, in green (mock: "About **you.**"). */
  accent?: string;
  subtitle?: string;
  onClose: () => void;
  closeIcon?: 'close' | 'back';
  children: React.ReactNode;
  /** Pinned under the scroll: usually <FormButton>, maybe a <FormTip> above it. */
  footer?: React.ReactNode;
}) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const insets = useSafeAreaInsets();
  const Icon = closeIcon === 'back' ? CaretLeft : X;
  return (
    <KeyboardAvoidingView style={[s.root, { paddingTop: insets.top + 8 }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.nav}>
        <Pressable style={s.navBtn} onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={closeIcon === 'back' ? 'Back' : 'Close'}>
          <Icon size={18} color={C.t1} weight="bold" />
        </Pressable>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.body}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.title} accessibilityRole="header">
          {title}{accent ? <Text style={{ color: C.green }}> {accent}</Text> : null}
        </Text>
        {!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
        <View style={s.fields}>{children}</View>
      </ScrollView>
      {!!footer && <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>{footer}</View>}
    </KeyboardAvoidingView>
  );
}

// ── Fields ──────────────────────────────────────────────────────────────────

/** Label row: name on the left, optional hint / counter on the right. */
export function FieldLabel({ children, hint, optional }: { children: string; hint?: string; optional?: boolean }) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  return (
    <View style={s.labelRow}>
      <Text style={s.label}>{children}{optional ? <Text style={s.optional}>  optional</Text> : null}</Text>
      {!!hint && <Text style={s.hint}>{hint}</Text>}
    </View>
  );
}

export function FormField({
  label, optional, error, counter, multiline, prefix, style, ...input
}: TextInputProps & {
  label: string;
  optional?: boolean;
  error?: string | null;
  /** Shows "n/max" on the label row (pass maxLength too). */
  counter?: boolean;
  /** A fixed bit before the text, e.g. "@". */
  prefix?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const [focused, setFocused] = useState(false);
  const len = typeof input.value === 'string' ? input.value.length : 0;
  return (
    <View style={style}>
      <FieldLabel optional={optional} hint={counter && input.maxLength ? `${len}/${input.maxLength}` : undefined}>{label}</FieldLabel>
      <View style={[s.field, multiline && s.fieldMulti, focused && s.fieldFocus, !!error && s.fieldError]}>
        {!!prefix && <Text style={s.prefix}>{prefix}</Text>}
        <TextInput
          placeholderTextColor={C.t3}
          selectionColor={C.green}
          {...input}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={[s.input, multiline && s.inputMulti]}
          onFocus={e => { setFocused(true); input.onFocus?.(e); }}
          onBlur={e => { setFocused(false); input.onBlur?.(e); }}
          accessibilityLabel={input.accessibilityLabel ?? label}
        />
      </View>
      {!!error && <Text style={s.error} accessibilityLiveRegion="polite">{error}</Text>}
    </View>
  );
}

// ── Choices ─────────────────────────────────────────────────────────────────

/** Pills (mock: age buttons). Selected = ink with white text. */
export function ChipGroup<T extends string | number>({
  label, options, value, onChange, optional, wrap = true,
}: {
  label?: string; optional?: boolean;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  /** false = one scrolling row. */
  wrap?: boolean;
}) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const chips = options.map(o => {
    const on = o.value === value;
    return (
      <Pressable key={String(o.value)} style={[s.chip, on && s.chipOn]} onPress={() => onChange(o.value)} accessibilityRole="button" accessibilityState={{ selected: on }}>
        <Text style={[s.chipTxt, on && s.chipTxtOn]}>{o.label}</Text>
      </Pressable>
    );
  });
  return (
    <View>
      {!!label && <FieldLabel optional={optional}>{label}</FieldLabel>}
      {wrap
        ? <View style={s.chipWrap}>{chips}</View>
        : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>{chips}</ScrollView>}
    </View>
  );
}

/** Mock OnbGoal cards: icon tile, title, line under it, round tick on the right. */
export function ChoiceCards<T extends string>({
  label, options, value, onChange,
}: {
  label?: string;
  options: { value: T; title: string; sub?: string; Icon?: IconType }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  return (
    <View>
      {!!label && <FieldLabel>{label}</FieldLabel>}
      <View style={{ gap: 10 }}>
        {options.map(o => {
          const on = o.value === value;
          return (
            <Pressable key={o.value} style={[s.choice, on && s.choiceOn]} onPress={() => onChange(o.value)} accessibilityRole="radio" accessibilityState={{ checked: on }}>
              {o.Icon && <View style={[s.choiceIcon, on && { backgroundColor: C.mint2 }]}><o.Icon size={20} color={C.t1} weight="regular" /></View>}
              <View style={{ flex: 1 }}>
                <Text style={s.choiceTitle}>{o.title}</Text>
                {!!o.sub && <Text style={s.choiceSub}>{o.sub}</Text>}
              </View>
              <View style={[s.radio, on && s.radioOn]}>{on && <Check size={13} color="#FFFFFF" weight="bold" />}</View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** A card with a title, a line under it and an on/off switch. */
export function ToggleRow({ title, sub, value, onChange }: { title: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  return (
    <Pressable style={s.toggle} onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <View style={{ flex: 1 }}>
        <Text style={s.choiceTitle}>{title}</Text>
        {!!sub && <Text style={s.choiceSub}>{sub}</Text>}
      </View>
      <View style={[s.switch, value && s.switchOn]}><View style={[s.knob, value && s.knobOn]} /></View>
    </Pressable>
  );
}

/** Next `days` days as chips ("Today", "Tomorrow", "Sat 21"), value YYYY-MM-DD (local). */
export function dayOptions(days = 14): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const d = new Date(); d.setHours(12, 0, 0, 0);
  for (let i = 0; i < days; i++) {
    const x = new Date(d.getTime() + i * 86_400_000);
    const iso = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    out.push({ value: iso, label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : x.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }) });
  }
  return out;
}

/** Common run start times, value HH:MM. */
export const TIME_OPTIONS = ['05:30', '06:00', '06:30', '07:00', '07:30', '17:30', '18:00', '18:30', '19:00', '19:30']
  .map(t => ({ value: t, label: (() => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; })() }));

// ── Footer ──────────────────────────────────────────────────────────────────

/** Mock "Why PaceX asks" card: lavender, orb, bold lead-in. */
export function FormTip({ lead, children }: { lead?: string; children: string }) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  return (
    <View style={s.tip}>
      <PaceXOrb size={22} />
      <Text style={s.tipTxt}>{lead ? <Text style={s.tipLead}>{lead} </Text> : null}{children}</Text>
    </View>
  );
}

/** The form's main button: the one PrimaryButton, 56 pt ink pill, full width. */
export function FormButton({ label, onPress, disabled, busy, tone = 'ink' }: {
  label: string; onPress: () => void; disabled?: boolean; busy?: boolean; tone?: 'ink' | 'danger';
}) {
  return (
    <PrimaryButton label={label} onPress={onPress} disabled={disabled} loading={busy}
      variant={tone === 'danger' ? 'destructive' : 'dark'} size="lg" fullWidth />
  );
}

/** Quiet second action under the main button ("Cancel", "Delete shoe"). */
export function FormLink({ label, onPress, tone = 'quiet' }: { label: string; onPress: () => void; tone?: 'quiet' | 'danger' }) {
  return <TextButton label={label} onPress={onPress} tone={tone === 'danger' ? 'danger' : 'default'} />;
}

// ── Styles (mock tokens) ────────────────────────────────────────────────────

function mk(C: AppColors) {
  return StyleSheet.create({
    root:      { flex: 1, backgroundColor: C.bg },
    nav:       { paddingHorizontal: 20, height: 52, justifyContent: 'center' },
    navBtn:    { width: 44, height: 44, borderRadius: 22, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    body:      { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 32 },
    title:     { fontFamily: Fonts.semiBold, fontSize: 34, lineHeight: 40, letterSpacing: -1, color: C.t1 },
    subtitle:  { fontFamily: Fonts.regular, fontSize: 16, lineHeight: 23, color: C.t2, marginTop: 8 },
    fields:    { marginTop: 26, gap: 20 },

    labelRow:  { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 },
    label:     { fontFamily: Fonts.medium, fontSize: 14, color: C.t1 },
    optional:  { fontFamily: Fonts.regular, fontSize: 13, color: C.t3 },
    hint:      { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    field:     { minHeight: 54, borderRadius: 18, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' },
    fieldMulti:{ minHeight: 108, alignItems: 'flex-start', paddingTop: 14, paddingBottom: 14 },
    fieldFocus:{ borderColor: C.t1 },
    fieldError:{ borderColor: C.danger },
    prefix:    { fontFamily: Fonts.regular, fontSize: 16, color: C.t2, marginRight: 10 },
    input:     { flex: 1, fontFamily: Fonts.regular, fontSize: 16, color: C.t1, paddingVertical: 0 },
    inputMulti:{ minHeight: 78, lineHeight: 22 },
    error:     { fontFamily: Fonts.regular, fontSize: 13, color: C.danger, marginTop: 6 },

    chipWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chipRow:   { gap: 8, paddingRight: 22 },
    chip:      { height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    chipOn:    { backgroundColor: C.t1, borderColor: C.t1 },
    chipTxt:   { fontFamily: Fonts.medium, fontSize: 15, color: C.t1 },
    chipTxtOn: { color: C.bg },

    choice:    { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 22, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border },
    choiceOn:  { backgroundColor: C.mint, borderColor: C.t1, borderWidth: 2 },
    choiceIcon:{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
    choiceTitle:{ fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    choiceSub: { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, marginTop: 2 },
    radio:     { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    radioOn:   { backgroundColor: C.brandGreen, borderColor: C.brandGreen },

    toggle:    { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 22, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border },
    switch:    { width: 50, height: 30, borderRadius: 15, backgroundColor: C.border, padding: 3, justifyContent: 'center' },
    switchOn:  { backgroundColor: C.brandGreen },
    knob:      { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF' },
    knobOn:    { alignSelf: 'flex-end' },
    // Six to a row on any phone: tiles share the width instead of a fixed size.
    iconWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    iconTile:  { width: '14.5%', aspectRatio: 1, flexGrow: 1, maxWidth: 64, borderRadius: 16, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    iconTileOn:{ backgroundColor: C.alwaysDark, borderColor: C.alwaysDark },

    footer:    { paddingHorizontal: 22, paddingTop: 12, gap: 12, backgroundColor: C.bg },
    tip:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, backgroundColor: C.lavender },
    tipTxt:    { flex: 1, fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20, color: C.lavenderInk },
    tipLead:   { fontFamily: Fonts.semiBold },
  });
}
