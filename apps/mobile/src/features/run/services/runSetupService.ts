import * as Location from 'expo-location';
import { getShoes, getDefaultShoe } from '@shared/services/store';
import type { StoredShoe } from '@shared/services/store';

export async function fetchShoes(): Promise<StoredShoe[]> {
  return getShoes();
}

export async function fetchDefaultShoe(): Promise<StoredShoe | null> {
  return (await getDefaultShoe()) ?? null;
}

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function checkLocationPermission(): Promise<boolean> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === 'granted';
}
