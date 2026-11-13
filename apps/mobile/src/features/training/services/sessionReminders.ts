/**
 * "Tomorrow's session" reminders (PRD N1): a local notification the day
 * before each planned session, at the hour the runner picked. Rescheduled
 * whenever the plan changes or the app opens, so moves and skips stay right.
 */
import * as Notifications from 'expo-notifications';
import { getSettings } from '@shared/services/store';
import { addDays, type TrainingPlanV2 } from '@shared/engine/training';

const PREFIX = 'plan-reminder-';
const AHEAD_DAYS = 14;
export const DEFAULT_REMINDER_HOUR = 18;

/** Local Date for `yyyy-mm-dd` at `hour`:00. */
function at(date: string, hour: number): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, hour, 0, 0);
}

export async function rescheduleSessionReminders(plan: TrainingPlanV2 | null): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled
      .filter(n => n.identifier.startsWith(PREFIX))
      .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));

    const settings = await getSettings();
    const hour = settings.planReminderHour === undefined ? DEFAULT_REMINDER_HOUR : settings.planReminderHour;
    if (!plan || hour == null || settings.notificationsEnabled === false) return;

    const now = Date.now();
    const until = now + AHEAD_DAYS * 86_400_000;
    for (const s of plan.weeks.flatMap(w => w.sessions)) {
      if (s.status !== 'planned') continue;
      const when = at(addDays(s.date, -1), hour);
      if (when.getTime() <= now || when.getTime() > until) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: PREFIX + s.id,
        content: {
          title: s.kind === 'race' ? 'Race day tomorrow' : `Tomorrow: ${s.title}`,
          body: s.summary,
          data: { actionUrl: '/training' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
      });
    }
  } catch {
    // Notifications are a nicety; never break plan saving over them.
  }
}
