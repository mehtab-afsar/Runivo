import type { AwardId, AwardCategory } from '../types/game';

export const AWARD_DEFINITIONS: Record<AwardId, {
  title: string;
  description: string;
  icon: string;
  category: AwardCategory;
}> = {
  first_claim:        { title: 'First Claim',       icon: '🗺',  description: 'Claimed your first territory zone',               category: 'territory' },
  first_blood:        { title: 'First Blood',        icon: '⚔️',  description: "Stole a rival's zone for the first time",         category: 'territory' },
  park_capture:       { title: 'Park Capture',       icon: '🌀',  description: 'Claimed a full park interior in one loop run',    category: 'territory' },
  district_owner:     { title: 'District Owner',     icon: '🏰',  description: 'Held a District-tier territory polygon',          category: 'territory' },
  quarter_owner:      { title: 'Quarter Owner',      icon: '🏯',  description: 'Held a Quarter-tier territory polygon',           category: 'territory' },
  domain_lord:        { title: 'Domain Lord',        icon: '👑',  description: 'Claimed a Domain — the largest territory tier',   category: 'territory' },
  city_builder:       { title: 'City Builder',       icon: '🌆',  description: '500,000 m² total territory claimed',             category: 'territory' },
  defender:           { title: 'Defender',           icon: '🛡',  description: 'Re-ran a stale zone before a rival could steal',  category: 'territory' },
  sovereign_rank:     { title: 'Sovereign',          icon: '⭐',  description: 'Reached the Sovereign runner rank (4,000 PACE)',  category: 'territory' },
  first_5k:           { title: 'First 5K',           icon: '👟',  description: 'Ran 5km in a single activity',                   category: 'distance' },
  first_10k:          { title: '10K Club',           icon: '🏃',  description: 'Ran 10km in a single activity',                  category: 'distance' },
  first_halfmarathon: { title: 'Half Done',          icon: '🎽',  description: 'Ran 21km in a single activity',                  category: 'distance' },
  km_100:             { title: '100km',              icon: '💯',  description: '100km total distance',                           category: 'distance' },
  km_500:             { title: '500km Club',         icon: '🦅',  description: '500km total distance',                           category: 'distance' },
  km_1000:            { title: '1000km',             icon: '🏆',  description: '1,000km lifetime',                              category: 'distance' },
  streak_7:           { title: 'On Fire',            icon: '🔥',  description: '7-day running streak',                          category: 'streak' },
  streak_30:          { title: 'Unstoppable',        icon: '💪',  description: '30-day running streak',                         category: 'streak' },
  early_bird:         { title: 'Early Bird',         icon: '🌅',  description: '5 runs completed before 6am',                   category: 'streak' },
  sub_5:              { title: 'Sub-5',              icon: '⚡',  description: 'Ran a kilometre in under 5:00/km',               category: 'pace' },
  sub_4_30:           { title: 'Sub-4:30',           icon: '🚀',  description: 'Ran a kilometre in under 4:30/km',              category: 'pace' },
  monthly_100:        { title: 'Century Month',      icon: '📅',  description: '100km in a single calendar month',              category: 'distance' },
};
