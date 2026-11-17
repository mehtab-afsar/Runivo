// Add a shoe, on the shared form kit (mock onboarding style).
import React, { useState } from 'react';
import { Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { RoadHorizon, Mountains, Flag, Sneaker } from 'phosphor-react-native';
import { useGearAdd } from '@features/gear/hooks/useGearAdd';
import { PhotoPicker } from '@features/gear/components/PhotoPicker';
import { CATEGORIES, type ShoeCategory } from '@features/gear/types';
import { FormScreen, FormField, ChoiceCards, ChipGroup, FormButton, FormTip } from '@mobile/shared/components/form/FormKit';
import { useTheme, Fonts } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ICON: Record<ShoeCategory, typeof RoadHorizon> = { road: RoadHorizon, trail: Mountains, track: Flag, casual: Sneaker };
const SUB: Record<ShoeCategory, string> = {
  road: 'Daily trainers and racers · about 700 km',
  trail: 'Lugs and rock plates · about 500 km',
  track: 'Spikes · about 400 km',
  casual: 'Walking and everyday · about 800 km',
};
const LIFE: Record<ShoeCategory, string> = { road: '700', trail: '500', track: '400', casual: '800' };

export default function GearAddScreen() {
  const C = useTheme();
  const navigation = useNavigation<Nav>();
  const {
    brand, model, nickname, category, maxKm, photoUri, setPhotoUri,
    updateField, updateCategory, submit, isValid, submitting, uploadingPhoto,
  } = useGearAdd();
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    if (await submit()) navigation.goBack();
    else setError('Check your connection and try again.');
  };

  return (
    <FormScreen
      title="Add"
      accent="shoes."
      subtitle="Every run you record adds to their kilometres, and we'll tell you when they're worn out."
      onClose={() => navigation.goBack()}
      closeIcon="back"
      footer={<>
        {!!error && <FormTip lead="Couldn't save them.">{error}</FormTip>}
        <FormButton label="Add shoes" onPress={handleSave} disabled={!isValid} busy={submitting} />
      </>}
    >
      <PhotoPicker uri={photoUri} onPick={setPhotoUri} />
      {uploadingPhoto && <Text style={{ fontFamily: Fonts.regular, fontSize: 13, color: C.t2 }}>Uploading photo…</Text>}
      <FormField label="Brand" value={brand} onChangeText={v => updateField('brand', v)} placeholder="Nike, Asics, Hoka…" maxLength={40} autoCapitalize="words" />
      <FormField label="Model" value={model} onChangeText={v => updateField('model', v)} placeholder="Pegasus 41" maxLength={60} autoCapitalize="words" />
      <FormField label="Nickname" optional value={nickname} onChangeText={v => updateField('nickname', v)} placeholder="Race day pair" maxLength={40} />
      <ChoiceCards
        label="Type"
        options={CATEGORIES.map(c => ({ value: c.value, title: c.label, sub: SUB[c.value], Icon: ICON[c.value] }))}
        value={category}
        onChange={v => { updateCategory(v); updateField('maxKm', LIFE[v]); }}
      />
      <ChipGroup
        label="Retire them at"
        options={['400', '500', '600', '700', '800', '1000'].map(k => ({ value: k, label: `${k} km` }))}
        value={maxKm}
        onChange={v => updateField('maxKm', v)}
      />
    </FormScreen>
  );
}
