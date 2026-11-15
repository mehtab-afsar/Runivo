# Moderation

Runivo has user-generated content (comments, posts, club chat, club and event text, profiles). Apple's Guideline 1.2 expects four things; this is how each is met and what a moderator does day to day.

| Apple expects | In Runivo |
|---|---|
| Filter objectionable material | A database trigger rejects comments, chat, bios, display names, club and event text that contain a word in `blocked_terms` (whole-word match, common letter swaps folded). The app shows "That can't be posted". |
| Report content | Visible **Report** actions on posts, comments (the `⋯` on each comment), club chat messages, clubs and events, and on runner profiles. |
| Block abusive users | **Block** on comments, club chat messages and profiles. Blocking is two-way in the feed, comments, club chat and profiles, enforced in the database (chat: migration `20261115000016`). |
| Act on reports and publish contact info | The admin **Moderation** tab, a 24-hour target, and `support@runivo.com` on the support page, in the Terms and in the privacy policy. |

## Daily process

1. Open `/admin`, **Moderation** (the default tab). Items are grouped by what was reported and sorted oldest first. Anything over 24 hours old is marked.
2. For each item, read the content and choose:
   - **Dismiss**: nothing wrong. The reports are closed.
   - **Remove**: deletes the content for everyone.
   - **Remove and suspend author**: also adds the author to `user_bans`. A suspended runner can still use the app but cannot post comments, posts or chat messages.
3. A comment is hidden automatically when three different people report it, before anyone looks. It stays in the queue so a moderator can confirm or restore it (set `hidden_at` to null in the database to restore).
4. Reports about a runner (`user_reports`) show the runner; the only action is dismiss or suspend.

Lifting a ban: delete the row in `user_bans` (SQL editor, service role). Clients cannot read or change it.

## Setting it up (once)

- Deploy migrations `20261115000015_moderation.sql` and `20261115000016_chat_blocks_two_way.sql`.
- Load the word list: run `supabase/seed/blocked_terms.sql`, then add a maintained list for the languages you support. The starter list is short on purpose and has no hate-speech terms; a word filter is a floor, not a moderator.
- Make sure at least two people have `profiles.subscription_tier = 'admin'`, so reports are not waiting on one person's holiday.
- Check the `support@runivo.com` mailbox exists and someone reads it. Apple tests this.

## What is still manual

- Club rosters and the "clubs near you" list do not yet hide blocked runners; chat, feed, comments and profiles do.
- `club_message_reports` are also visible to the club's own admins, who can delete messages and remove members; Runivo moderators see them in the same queue.
- No automatic image review. Photos are reported and removed the same way as text.
