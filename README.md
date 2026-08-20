# Carbon Commandos — v0.1 (MVP)

This is the first working slice of Carbon Commandos, covering Phases 1-4 of the
build plan we agreed on: game setup, self-registration with team picking, admin
role assignment, the full QR combat scan flow, and a live admin dashboard.

**Not in this build yet** (next increments, same schema/foundation): the shop
and inventory, missions/checkpoints, the tactical map, random events, printable
QR cards, and the tactical UI polish pass. Those are Phases 5-8 — say the word
and I'll build the next slice on top of this one.

## Important: this needs to be installed and run on a machine with internet access

The sandbox I built this in doesn't have access to the npm/package registries
(a network restriction on this session, not a problem with the code), so I
could not run `npm install` or start the app myself to test it live. I did
type-check every file for syntax errors, and I connected directly to your
"Commandos Game" Neon database to confirm the project and credentials are
correct — but the very first real run needs to happen on your own computer
(or directly on DigitalOcean). Treat the first run as the actual test.

## What's already done for you

Your `.env` file is already filled in with your real "Commandos Game" Neon
database connection and a generated admin login:

- **Admin email:** michaelmgrgs@gmail.com
- **Admin password:** see the `SEED_ADMIN_PASSWORD` line in `.env`

There's no "change password" screen yet in this first version, so for now
just keep that password to yourself — I can add account management in a
later slice if you'd like.

## Running it on your own computer (to try it out first)

You'll need [Node.js](https://nodejs.org) installed (version 18 or newer).

1. Unzip this folder and open a terminal inside it.
2. Install dependencies:
   ```
   npm install
   ```
3. Create the database tables in your Neon project (this reads `prisma/schema.prisma`
   and builds every table automatically — safe to run, only touches the
   "Commandos Game" database, never the Carbon Camp one):
   ```
   npx prisma db push
   ```
4. Create your admin login:
   ```
   npm run db:seed
   ```
5. Start it:
   ```
   npm run dev
   ```
6. Open http://localhost:3000 in your browser. Admin login is at `/admin/login`,
   the player join page is at `/join`.

On your phone, since a phone can't reach `localhost` on your computer, you'd
need it deployed (next section) to actually test the camera-scanning flow —
or use your computer's own camera via a webcam for a first click-through.

## How to actually run this live (DigitalOcean, as planned)

This matches the architecture doc's deployment section exactly:

1. Put this code in a GitHub repository (private is fine).
2. In DigitalOcean, create a new **App Platform** app pointed at that repo.
   It'll detect this as a Next.js app automatically.
3. In the app's Settings → Environment Variables, add the same three values
   from your `.env` file: `DATABASE_URL`, `ADMIN_SESSION_SECRET`, and (only
   needed once, for the first deploy) the `SEED_ADMIN_*` values.
4. Deploy. DigitalOcean will run `npm install` and `npm run build` for you.
5. The very first time only, run the database setup commands against your
   live database — easiest way is to run `npx prisma db push` and
   `npm run db:seed` from your own computer with the same `.env` file
   pointed at the same Neon database (they don't need to run "on" DigitalOcean,
   they just need to reach the same database, which they will since it's the
   same `DATABASE_URL`).
6. In GoDaddy's DNS settings, add a CNAME record for a subdomain (e.g.
   `commandos`) pointing at the address DigitalOcean gives you for the app.
   Your main WordPress site is untouched.

## How the game actually runs on the night

1. Go to `/admin/setup`, log in, create the game.
2. Add your teams (name, color, how many players each can hold).
3. Click "Quick setup" for roles (2 Spies, 1 General, 2 Colonels, rest
   Soldiers) — or add your own roles with your own numbers. Adjust the
   elimination matrix if you want anything other than the sensible default
   (everyone can eliminate everyone, except the General can't attack).
4. Click "Open registration" and share the `/join` link with players — they
   pick their name and team themselves.
5. As players come in, go to the roster on `/admin/dashboard` and assign each
   one a role from the dropdown — it only offers roles that still have open
   slots on that team.
6. Once everyone has a role, click "Go live" — this is blocked until every
   registered player has a role, so you can't accidentally start half-set-up.
7. Players tap **SHOW MY QR** when they're caught, the winner taps **SCAN
   TARGET** and scans it — the result applies immediately, and you'll see it
   appear on the dashboard within a few seconds.
8. Use the roster's Pause / +Life / −Life / Revive / Eliminate / role-and-team
   dropdowns any time you need to make a manual correction.

## What's next

The natural next slice, in order, is: the Armory/shop + credits ledger,
missions with the forced full-screen task takeover we discussed, checkpoints,
the tactical map, and the visual polish pass. Just let me know when you want
me to build the next one — this MVP's schema and folder structure are already
set up so those slot in without reworking anything you're testing now.
