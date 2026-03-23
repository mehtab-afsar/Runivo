import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, SafeAreaView, Platform, KeyboardAvoidingView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useCreateEvent } from '../hooks/useCreateEvent';
import { EventForm } from '../components/EventForm';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CreateEventScreen() {
  const navigation = useNavigation<Nav>();
  const {
    saving, error, canSubmit,
    title, setTitle, eventType, setEventType,
    date, setDate, time, setTime,
    location, setLocation, distanceKm, setDistanceKm,
    description, setDescription, submit,
  } = useCreateEvent();

  const handleSubmit = async () => {
    const ok = await submit();
    if (ok) navigation.goBack();
  };

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.header}>
          <Pressable onPress={() => navigation.goBack()} style={s.back}>
            <Text style={s.backText}>←</Text>
          </Pressable>
          <Text style={s.title}>Create Event</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <EventForm
            saving={saving} error={error} canSubmit={canSubmit}
            title={title} setTitle={setTitle}
            eventType={eventType} setEventType={setEventType}
            date={date} setDate={setDate}
            time={time} setTime={setTime}
            location={location} setLocation={setLocation}
            distanceKm={distanceKm} setDistanceKm={setDistanceKm}
            description={description} setDescription={setDescription}
            onSubmit={handleSubmit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EDEAE5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12 },
  back: { width: 32 }, backText: { fontFamily: 'Barlow_400Regular', fontSize: 18, color: '#6B6B6B' },
  title: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: '#0A0A0A' },
  content: { paddingHorizontal: 20, paddingBottom: 60, gap: 4 },
});
