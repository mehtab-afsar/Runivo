/**
 * Add to calendar and an evening-before reminder for events (PRD E2).
 * Uses the system "new event" sheet, so nothing is written without the
 * runner confirming it there. Without expo-calendar in the build, only the
 * reminder is offered.
 */
import * as Notifications from 'expo-notifications';
import { getCalendar } from '@mobile/shared/lib/optionalNative';
import type { RunEvent } from '../types';

const REMINDER_PREFIX = 'event-reminder-';
const DEFAULT_MINUTES = 90;

export const canAddToCalendar = () => getCalendar() != null;

/** Opens the system sheet prefilled with the event. Resolves true when saved. */
export async function addEventToCalendar(e: RunEvent): Promise<boolean> {
  const Calendar = getCalendar();
  if (!Calendar) return false;
  const start = new Date(e.startsAt);
  const end = new Date(start.getTime() + DEFAULT_MINUTES * 60_000);
  const notes = [e.description, e.registrationUrl].filter(Boolean).join('\n\n');
  const result = await Calendar.createEventInCalendarAsync({
    title: e.title,
    startDate: start,
    endDate: end,
    location: e.location,
    notes: notes || undefined,
    url: e.registrationUrl,
  });
  return result.action === 'saved' || result.action === 'done';
}

/** 7 pm local the evening before (or 2 hours before, if that's already past). */
export function reminderTime(startsAt: string, now = Date.now()): Date | null {
  const start = new Date(startsAt);
  const eve = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1, 19, 0, 0);
  if (eve.getTime() > now) return eve;
  const soon = new Date(start.getTime() - 2 * 3_600_000);
  return soon.getTime() > now ? soon : null;
}

export async function hasEventReminder(eventId: string): Promise<boolean> {
  const all = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  return all.some(n => n.identifier === REMINDER_PREFIX + eventId);
}

/** Returns when the reminder will fire, or null when the event is too close. */
export async function setEventReminder(e: RunEvent, on: boolean): Promise<Date | null> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_PREFIX + e.id).catch(() => {});
  if (!on) return null;
  const when = reminderTime(e.startsAt);
  if (!when) return null;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) {
    const asked = await Notifications.requestPermissionsAsync();
    if (!asked.granted) return null;
  }
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_PREFIX + e.id,
    content: {
      title: when.getDate() === new Date(e.startsAt).getDate() ? `Soon: ${e.title}` : `Tomorrow: ${e.title}`,
      body: `${e.time} · ${e.location}`,
      data: { actionUrl: '/events' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
  });
  return when;
}
