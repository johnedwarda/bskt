# bskt

Shared shopping lists. Built with Expo (React Native, Expo Router) and Supabase. The UI follows the
**bskt** design canvas: intro, log in / sign up, lists, the list itself (tiles, due soon, drag
into the cart), the Add screen, and the item and list-edit sheets.

## Set up

1. **Node.js LTS.** On Fedora: `sudo dnf install nodejs`.
2. **Install dependencies.** Run `npm run setup`. It installs the latest Expo SDK and lets
   `expo install` choose the matching version of every native module. It also creates `.env`.
3. **Create a Supabase project** at supabase.com, then:
   - **Database:** paste `supabase/migrations/20261115000000_init.sql` into the SQL Editor and run it.
     Or use the CLI: `npx supabase init`, then `npx supabase link --project-ref <ref>`, then
     `npx supabase db push`.
   - **Keys:** copy the project URL and anon key from Settings → API into `.env`.
   - **Redirect URLs:** under Authentication → URL Configuration, add `bskt://**` (and `exp://**`
     while you use Expo Go). Social sign-in and email links need these.
   - **Optional:** turn on the Apple and Google providers under Authentication → Providers to
     enable the "Continue with…" buttons.
4. **Run it:** `npx expo start`, then press `i` for iOS, `a` for Android, or scan the QR code
   with Expo Go.

## How it works

| Where | What |
| --- | --- |
| `supabase/migrations/` | Tables (`profiles`, `lists`, `list_members`, `list_invites`, `items`, `purchases`), row-level security (only members can see or change a list), RPCs (`create_list`, `invite_to_list`, `join_list`, `rotate_invite_token`), realtime publication |
| `src/lib/ListStore.tsx` | One list's live state and every action on it. Updates show locally first, then save to Supabase. Realtime keeps everyone's screen in sync |
| `src/lib/rhythm.ts` | "Due" logic. Each move into the cart records a purchase. After two purchases bskt uses the average gap between them; with fewer it uses the catalog's typical interval |
| `src/lib/parse.ts` | Understands typed input such as `2 l oat milk` (2 L of milk, type "Oat") or `greek yogurt` |
| `src/lib/catalog.ts` | The built-in items from the prototype: illustration, colours, aisle group, units, types |
| `src/components/Illo.tsx` | The 24 item illustrations, ported from the design's Illo component |

**Shopping order:** each item starts at its catalog aisle position. When you put something in the
cart, it moves closer to just after the item you put in before it on the same trip. Over a few
trips, "by shopping order" comes to match the way you walk the shop.

**Sharing:** "Invite by email" adds people who already have an account straight away. Anyone else
joins automatically when they sign up with that email. "Copy invite link" copies a `bskt://join/…`
link.

## Changes from the prototype

- Typing uses the phone's own keyboard. The drawn keyboard was only a stand-in for the prototype.
- The cart panel has a **Finish shopping** button. It takes everything in the cart off the list,
  and those items come back under "Due soon" when they're due. The prototype had no way to empty
  the cart.
- Inviting works by email only. The prototype's field also accepted a name or phone number.
- Tiles have a "Put in cart" accessibility action, so screen-reader users don't need to drag.

## Not done yet

- **Push notifications:** the two switches are saved per person, but nothing sends notifications
  yet. That needs Expo push tokens plus a Supabase Edge Function or database webhook.
- **Universal links:** invite links use the `bskt://` scheme, so they only open on phones that
  have the app installed.
- **Password reset:** "Forgot password?" sends Supabase's reset email, but the app has no
  "set a new password" screen yet.
- The Terms and Privacy Policy text is a placeholder.
