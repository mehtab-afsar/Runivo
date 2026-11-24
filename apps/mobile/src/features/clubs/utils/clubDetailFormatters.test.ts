import { describe, it, expect } from 'vitest';
import {
  activityLabel, formatTimeAgo, buildTabs, resolveTabValue, clubSubLine, joinButtonLabel, memberMetaLine, reportSummaryLine,
} from './clubDetailFormatters';

describe('clubDetailFormatters', () => {
  it('maps known activity actions and passes unknown ones through', () => {
    expect(activityLabel('captured')).toBe('captured a territory');
    expect(activityLabel('leveled_up')).toBe('leveled up');
    expect(activityLabel('mystery')).toBe('mystery');
  });

  it('formats time ago in minutes, hours and days', () => {
    const now = new Date('2026-01-10T12:00:00Z').getTime();
    expect(formatTimeAgo('2026-01-10T11:55:00Z', now)).toBe('5m ago');
    expect(formatTimeAgo('2026-01-10T09:00:00Z', now)).toBe('3h ago');
    expect(formatTimeAgo('2026-01-08T12:00:00Z', now)).toBe('2d ago');
  });

  it('only shows the Admin tab to admins', () => {
    expect(buildTabs('member').map(t => t.key)).toEqual(['home', 'chat', 'members', 'leaderboard']);
    expect(buildTabs(null).map(t => t.key)).toEqual(['home', 'chat', 'members', 'leaderboard']);
    expect(buildTabs('admin').map(t => t.key)).toEqual(['home', 'chat', 'members', 'leaderboard', 'admin']);
  });

  it('keeps Home selected for the Runs and Territory sub-pages', () => {
    expect(resolveTabValue('runs')).toBe('home');
    expect(resolveTabValue('ground')).toBe('home');
    expect(resolveTabValue('chat')).toBe('chat');
  });

  it('builds the club sub line', () => {
    expect(clubSubLine(1, 12.4, false)).toBe('1 member · 12 km');
    expect(clubSubLine(3, 0, true)).toBe('3 members · 0 km · admin');
  });

  it('picks the join button label', () => {
    expect(joinButtonLabel(true, undefined, 'open', 'Dawn')).toBe('Joining…');
    expect(joinButtonLabel(false, undefined, 'open', 'Dawn')).toBe('Join Dawn');
    expect(joinButtonLabel(false, undefined, undefined, 'Dawn')).toBe('Join Dawn');
    expect(joinButtonLabel(false, 'abc', 'invite_only', 'Dawn')).toBe('Join Dawn');
    expect(joinButtonLabel(false, undefined, 'invite_only', 'Dawn')).toBe('Ask to join');
  });

  it('builds member and report lines', () => {
    expect(memberMetaLine(0.4)).toBe('New member');
    expect(memberMetaLine(42.6)).toBe('43 km with the club');
    expect(reportSummaryLine(1, ['spam'])).toBe('1 report · spam');
    expect(reportSummaryLine(2, ['spam', 'harassment'])).toBe('2 reports · spam, harassment');
  });
});
