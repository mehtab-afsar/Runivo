import React, { useMemo } from 'react';
import { appAlert } from '@mobile/shared/components/AppAlert';
import { View, Text, TextInput, Pressable, ScrollView, Image, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from '@mobile/shared/icons/lucideCompat';
import { validateUsername } from '@shared/engine/onboarding';
import { useTheme, Fonts } from '@theme';
import { mkStep } from './onboardingStyles';

interface Props {
  username: string;
  avatarUri: string | null;
  serverError: string;
  onUsername: (v: string) => void;
  onAvatar: (uri: string | null) => void;
}

/** Username (required, shown to rivals) and photo (optional). */
export default function IdentityStep({ username, avatarUri, serverError, onUsername, onAvatar }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStep(C), [C]);
  const check = validateUsername(username);
  const showError = username.length > 0 && !check.ok;

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      appAlert('Photos are off', 'Allow photo access for Runivo in Settings to add a picture. You can skip this and add one later.');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (!r.canceled && r.assets?.[0]?.uri) onAvatar(r.assets[0].uri);
  }

  return (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.eyebrow}>Your name</Text>
      <Text style={s.title}>What do rivals{'\n'}call you?</Text>
      <Text style={s.sub}>Your name shows on zones you hold and on the leaderboard.</Text>

      <Pressable onPress={pickPhoto} style={st.avatarWrap} accessibilityRole="button" accessibilityLabel="Add a photo (optional)">
        {avatarUri
          ? <Image source={{ uri: avatarUri }} style={[st.avatar, { borderColor: C.red }]} />
          : (
            <View style={[st.avatar, { backgroundColor: C.card, borderColor: C.border }]}>
              <Camera size={26} color={C.t2} strokeWidth={2} />
            </View>
          )}
        <Text style={[st.avatarLabel, { color: C.t2 }]}>{avatarUri ? 'Change photo' : 'Add a photo (optional)'}</Text>
      </Pressable>

      <View style={[s.input, st.row, (showError || !!serverError) && s.inputError]}>
        <Text style={[st.at, { color: C.t3 }]}>@</Text>
        <TextInput
          value={username}
          onChangeText={v => onUsername(v.replace(/\s/g, '').toLowerCase())}
          placeholder="yourname"
          placeholderTextColor={C.t3}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username-new"
          textContentType="username"
          maxLength={20}
          style={[st.field, { color: C.t1 }]}
          accessibilityLabel="Username"
        />
      </View>
      {showError && !check.ok && <Text style={s.error}>{check.error}</Text>}
      {!!serverError && <Text style={s.error}>{serverError}</Text>}
      <Text style={s.note}>Lowercase letters, numbers and underscores. You can change it later.</Text>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  avatarWrap:  { alignItems: 'center', marginBottom: 22 },
  avatar:      { width: 96, height: 96, borderRadius: 48, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarLabel: { fontFamily: Fonts.medium, fontSize: 13, marginTop: 8 },
  row:         { flexDirection: 'row', alignItems: 'center' },
  at:          { fontFamily: Fonts.medium, fontSize: 18, marginRight: 2 },
  field:       { flex: 1, height: '100%', fontFamily: Fonts.medium, fontSize: 18 },
});
