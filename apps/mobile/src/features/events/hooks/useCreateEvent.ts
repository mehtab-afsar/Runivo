import { useState, useCallback } from 'react';
import { createEvent } from '../services/eventService';

export interface CreateEventForm {
  title: string;
  eventType: string;
  date: string;
  time: string;
  location: string;
  distanceKm: string;
  description: string;
}

const EVENT_TYPES = [
  { value: 'community-run',   label: 'Community Run' },
  { value: 'race',            label: 'Race' },
  { value: 'challenge',       label: 'Challenge' },
  { value: 'brand-challenge', label: 'Brand Challenge' },
  { value: 'king-of-hill',    label: 'King of the Hill' },
  { value: 'survival',        label: 'Survival Run' },
];

export { EVENT_TYPES };

export function useCreateEvent() {
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [title, setTitle]             = useState('');
  const [eventType, setEventType]     = useState('community-run');
  const [date, setDate]               = useState('');
  const [time, setTime]               = useState('');
  const [location, setLocation]       = useState('');
  const [distanceKm, setDistanceKm]   = useState('');
  const [description, setDescription] = useState('');

  const canSubmit = title.trim().length >= 3 && !!date && !!time && location.trim().length >= 2;

  const submit = useCallback(async (): Promise<boolean> => {
    if (!canSubmit) return false;
    setSaving(true);
    setError('');
    try {
      await createEvent({ title, eventType, date, time, location, distanceKm, description });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [canSubmit, title, eventType, date, time, location, distanceKm, description]);

  return {
    saving, error, canSubmit,
    title, setTitle,
    eventType, setEventType,
    date, setDate,
    time, setTime,
    location, setLocation,
    distanceKm, setDistanceKm,
    description, setDescription,
    submit,
  };
}
