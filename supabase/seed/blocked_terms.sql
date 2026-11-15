-- Starter list for public.blocked_terms (migration 20261115000015_moderation.sql).
-- Run in Supabase -> SQL Editor. Safe to run again.
--
-- This is deliberately short: common profanity and sexual terms only. It does NOT
-- contain slurs or other hate speech. Before launch, load a maintained list for
-- the languages you support (for example the open "List of Dirty, Naughty,
-- Obscene, and Otherwise Bad Words", github.com/LDNOOBW), one lowercase word per
-- row, and review it: a word filter is a floor, not a moderator.
--
-- Matching is whole word, after folding 0/1/3/4/@/$/5/! to letters, so "class"
-- and "Scunthorpe" are fine and "a$$" is not. Multi-word phrases are not supported.
INSERT INTO public.blocked_terms (term) VALUES
  ('fuck'), ('fucking'), ('fucker'), ('motherfucker'), ('shit'), ('bullshit'),
  ('bitch'), ('bastard'), ('asshole'), ('cunt'), ('dick'), ('dickhead'),
  ('pussy'), ('slut'), ('whore'), ('wanker'), ('twat'), ('porn'), ('rape'),
  ('rapist'), ('kys')
ON CONFLICT (term) DO NOTHING;
