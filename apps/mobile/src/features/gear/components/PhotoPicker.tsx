import React from 'react';
import { View, Text, Image, Pressable, StyleSheet, Alert } from 'react-native';
import { Footprints } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@theme';

const C = Colors;

interface PhotoPickerProps {
  uri: string | null;
  onPick: (uri: string) => void;
}

export function PhotoPicker({ uri, onPick }: PhotoPickerProps) {
  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Enable photo library access in Settings to add a shoe photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) onPick(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Enable camera access in Settings to take a shoe photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) onPick(result.assets[0].uri);
  };

  return (
    <View style={s.row}>
      {uri
        ? <Image source={{ uri }} style={s.thumb} />
        : <View style={s.placeholder}><Footprints size={28} color="#6B6B6B" strokeWidth={1.5} /></View>
      }
      <View style={{ gap: 8, flex: 1 }}>
        <Pressable style={s.btn} onPress={takePhoto}>
          <Text style={s.btnText}>Take Photo</Text>
        </Pressable>
        <Pressable style={s.btn} onPress={pickFromLibrary}>
          <Text style={s.btnText}>Choose from Library</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16, marginBottom: 4 },
  thumb: { width: 72, height: 72, borderRadius: 12 },
  placeholder: {
    width: 72, height: 72, borderRadius: 12,
    backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  btn: {
    backgroundColor: C.white, borderRadius: 8, borderWidth: 0.5, borderColor: C.border,
    paddingVertical: 8, paddingHorizontal: 12,
  },
  btnText: { fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.black },
});
