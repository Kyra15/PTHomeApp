# Demo checklist — doctor + patient + assigned exercises

The core demo: create a doctor account and a patient account, link them, have the doctor assign a few varied
exercises, and show the patient doing them on the iPhone with live motion tracking. About 5 minutes.

## Start everything (terminal commands)

You need three things running: the **backend** (Flask API), the **portal** (doctor website) and the **iPhone app**.
Commands are for macOS (the iPhone build needs a Mac with Xcode). Use one terminal window per app and leave each
one running.

> **Keep the repo in a folder whose path has no spaces** (e.g. `~/code/PTHomeApp`, not `~/My Projects/...`), and
> not inside an iCloud-synced Desktop/Documents folder. Spaces and iCloud syncing both break iOS build scripts.

### Apply the patch (once)

These commands work whatever state your copy is in, including after a failed earlier attempt. They make a fresh
`demo-ready` branch from GitHub's `main` and apply the patch to it. Your `main` branch isn't changed. Save any
work in progress first: the `reset` line discards uncommitted changes to tracked files. If you already applied
an earlier version of this patch, that's fine: the new branch starts from GitHub's `main`, so it isn't applied twice.

```bash
cd ~/code/PTHomeApp                              # wherever your clone is
# 1. git refuses to apply patches (and even to cancel a failed attempt) until it knows your name + email
git config user.name >/dev/null || git config user.name "Kyra Movva"
git config user.email >/dev/null || git config user.email "you@example.com"
# 2. clear any half-finished earlier attempt
git am --abort 2>/dev/null; rm -rf .git/rebase-apply
git reset --hard                                 # drops leftovers from that attempt (untracked files like .venv stay)
# 3. fresh branch from GitHub's main, then apply
git fetch origin
git checkout -B demo-ready origin/main
git am ~/Downloads/kinetic-demo-ready.patch      # the path to the downloaded patch
git log --oneline -1                             # should show "Demo-ready: …"
```

If `git am` still fails, run `git am --abort`, then use `git apply --3way ~/Downloads/kinetic-demo-ready.patch`
instead (it applies the same changes without making the commit; commit them yourself afterwards).

Every later session, just start from the repo folder on that branch:

```bash
cd ~/code/PTHomeApp
git checkout demo-ready
```

### Find your Mac's local IP (only if the backend runs on your Mac)

The iPhone can't reach `127.0.0.1` (that means the phone itself), so it needs your Mac's address on the Wi-Fi.
Phone and Mac must be on the **same Wi-Fi**.

```bash
ipconfig getifaddr en0          # prints something like 192.168.1.20 — use it below in place of <MAC_IP>
```

### Terminal 1 — backend (Flask API)

**Option A: use Render (no terminal needed).** Push the `demo-ready` branch and deploy it (Render dashboard →
your `kinetic-backend` service → *Manual Deploy* → *Deploy latest commit*, after pointing the service at the
branch, or merge to main). Check it's up:

```bash
curl https://<your-backend>.onrender.com/health      # want: {"status":"ok","supabase":"connected"}
```

Then use `https://<your-backend>.onrender.com` as the backend URL in Terminals 2 and 3.

**Option B: run it on your Mac.**

First time only:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
open -e .env        # fill in SUPABASE_URL and SUPABASE_SECRET_KEY (sb_secret_...), save, close
```

Every time:

```bash
cd backend
source .venv/bin/activate
set -a; source .env; set +a                      # load the variables into this terminal
pytest -q                                         # optional sanity check: 51 passed
flask --app wsgi run --host 0.0.0.0 --port 5000   # 0.0.0.0 so the iPhone can reach it
```

Check it from a second terminal: `curl http://127.0.0.1:5000/health`. The backend URL for Terminals 2 and 3 is
`http://<MAC_IP>:5000`. (If you open the portal at an address other than `http://localhost:5173`, add it to
`CORS_ORIGINS` in `backend/.env`, comma-separated, and restart Flask.)

### Terminal 2 — doctor portal (website)

First time only:

```bash
cd admin-web
npm install
cp .env.example .env.local
open -e .env.local
#   VITE_SUPABASE_URL=https://<ref>.supabase.co
#   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
#   VITE_API_BASE_URL=http://127.0.0.1:5000      (or your Render URL)
```

Every time:

```bash
cd admin-web
npm run dev          # then open http://localhost:5173 in your browser
```

(After editing `.env.local`, stop with Ctrl+C and run `npm run dev` again.)

### Terminal 3 — patient iPhone app

First time only (from the repo root, not a subfolder):

```bash
npm install
cp .env.example .env.local
open -e .env.local
#   EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
#   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
#   EXPO_PUBLIC_API_BASE_URL=http://<MAC_IP>:5000   (or your Render URL — never 127.0.0.1)
```

Plug the iPhone into the Mac with a cable, unlock it, and tap *Trust* if asked. Then build and install the app
on the phone (first time, after `npm install`, or after pulling changes — takes a few minutes):

```bash
npm run ios:clean               # regenerates the ios/ folder from scratch, then builds + installs on the iPhone
                                # (same as: npx expo prebuild --platform ios --clean && npx expo run:ios --device)
```

`ios/` is generated from `app.json` and is git-ignored, so deleting and regenerating it is always safe. Use
`npm run ios:device` to rebuild without regenerating.

If Xcode complains about signing: open `ios/HomePTCoach.xcworkspace` in Xcode → the *HomePTCoach* target →
*Signing & Capabilities* → choose your Apple ID team, then run `npm run ios:device` again. On the phone, if it says
"Untrusted Developer": Settings → General → VPN & Device Management → trust your Apple ID.

#### If the build fails with "Command PhaseScriptExecution failed with a nonzero exit code"

That means one of Xcode's build scripts failed. The real reason is printed a few lines **above** that message.
Go through these in order and retry after each:

1. **Xcode can't find Node.** This is the most common cause with nvm or Homebrew. The repo now records your Node
   path in `ios/.xcode.env.local` every time the project is generated, so `npm run ios:clean` fixes this.
   To check it: `cat ios/.xcode.env.local` should show a path, and running that path with `--version` should
   print a version. To set it by hand: `echo "export NODE_BINARY=$(command -v node)" > ios/.xcode.env.local`.
2. **Stale native project or pods.** Start over from a clean state:
   ```bash
   rm -rf ios node_modules
   npm install
   npm run ios:clean
   ```
3. **Space in the folder path** (`npm run ios:clean` prints a ⚠️ warning if there is one). Move the repo, e.g.
   `mkdir -p ~/code && mv ~/"My Projects/PTHomeApp" ~/code/PTHomeApp`, then `cd ~/code/PTHomeApp` and repeat step 2.
4. **CocoaPods / Xcode setup.** Check the setup: `xcode-select -p` should print
   `/Applications/Xcode.app/Contents/Developer` (if not, `sudo xcode-select -s /Applications/Xcode.app`); open
   Xcode once and accept any license / component install; `pod --version` should print a version (if not,
   `brew install cocoapods`).
5. Still failing? Build from Xcode to see the full log: `open ios/HomePTCoach.xcworkspace`, press ⌘B, open the
   Report navigator (⌘9), click the failed build, expand the red script step. Copy the ~20 lines above the error.

Other build errors you might hit next:
- **"Personal development teams … do not support the Push Notifications capability"**: push notifications were
  removed from the app (patients see doctor invitations on the in-app card instead), so this shouldn't happen any
  more. If it still does, the old `ios/` folder is being reused: run `npm run ios:clean`.
- **"Failed to register bundle identifier"**: change `ios.bundleIdentifier` in `app.json` to something unique
  (e.g. `com.kyramovva.kinetic`), then `npm run ios:clean`.

#### If the app builds but closes immediately when opened

- **"UIScene life cycle is required for apps built with this SDK"** in Xcode's console: newer Xcode versions
  refuse to launch apps that don't use the scene life cycle, and Expo's generated project doesn't yet.
  `plugins/withSceneLifecycle.js` adds it every time `ios/` is generated, so run `npm run ios:clean`. If you
  still see the message, `ios/` is old: check that `ios/HomePTCoach/AppDelegate.swift` contains `class SceneDelegate`.
- **Nothing in Metro's logs**: a *debug* build downloads its JavaScript from your Mac every time it opens. Make
  sure the `npx expo start` terminal is running, the phone is on the same Wi-Fi as the Mac, and Settings →
  Privacy & Security → Local Network → *Home PT Coach* is ON. Or use a Release build (below), which doesn't need
  the Mac at all.
- **To see why it crashed**: `open ios/HomePTCoach.xcworkspace`, pick your iPhone at the top, press ⌘R, and
  read the bottom console when it stops. On the phone itself, crash reports are in Settings → Privacy & Security →
  Analytics & Improvements → Analytics Data → `HomePTCoach-…`.

#### For the demo: a Release build (runs without the Mac)

```bash
npm run ios:release      # same as ios:clean, but builds the Release configuration
```

The JavaScript and your `.env.local` values are packaged into the app, so it opens like a normal app: no
`expo start`, no shared Wi-Fi with the Mac, no "connecting to development server". `EXPO_PUBLIC_API_BASE_URL` must
therefore be an address the phone can reach on demo day (your Render URL). Rebuild after changing `.env.local`.
A free Apple ID's builds stop opening after 7 days; just run `npm run ios:release` again.

Every time after that, for a **debug** build (app already installed on the phone):

```bash
npx expo start --clear     # then open the Kinetic app on the iPhone (same Wi-Fi as the Mac)
```

Restart this command (Ctrl+C, run again) whenever you change `.env.local` — `--clear` makes sure the new values
are picked up.

### Optional — ready-made demo accounts

In a terminal with the backend's virtualenv and `.env` loaded (see Terminal 1, Option B):

```bash
cd backend
source .venv/bin/activate
set -a; source .env; set +a
python scripts/demo_setup.py --doctor dr.lee@example.com --patient jordan@example.com --password demo-pass-123
# add --no-program to link the accounts but assign the exercises live in the portal
```

### Shutting down

Press Ctrl+C in each terminal. Next time, run only the **Every time** commands.

## The day before

- [ ] **Database:** migrations `0001`–`0007` have been run in the Supabase SQL Editor (the program editor needs no
      new migration). `backend/supabase/tests_rls.sql` should return every row `passed = true`.
- [ ] **Backend:** redeploy on Render so the new `/therapist/patients…` endpoints exist. Check
      `https://<backend>/health` says `"supabase": "connected"`.
- [ ] **Portal:** `admin-web/.env.local` has the Supabase URL, publishable key and `VITE_API_BASE_URL` = the Render
      URL. Run `npm run dev` (or redeploy it). Backend `CORS_ORIGINS` must include the portal's URL.
- [ ] **iPhone app:** `.env.local` (copy `.env.example`) uses the **Render URL** for `EXPO_PUBLIC_API_BASE_URL` —
      `127.0.0.1` on a phone means the phone itself. Use a real iPhone: the simulator has no motion sensors.
- [ ] **Confirmation emails:** Supabase → Authentication → Providers → Email → *Confirm email* is ON, so a new
      patient has to tap a link before signing in. Supabase's built-in email sender is heavily rate-limited, so
      either do the patient sign-up beforehand, set up custom SMTP (Resend works) under Authentication → SMTP, or use
      the backup script below.
- [ ] Rehearse once end to end with throwaway emails.

## 2 minutes before

- [ ] Open `https://<backend>/health` — Render's free tier sleeps and the first request takes ~50 s.
- [ ] Portal open on the sign-in page; app open on the Welcome screen; phone volume up (rep counts are spoken).

## Run of show

1. **Doctor account (portal)** — *Create a clinician account*: name, email, password, office. You land on an empty
   Patient Roster.
2. **Patient account (app)** — *Create Account* → "Almost done! Check your email…" → tap the link in the email →
   *Sign In*. The dashboard says "No exercises yet".
3. **Invite (portal)** — *Invite Patient* → patient's email → *Send invitation*. The code is shown (and emailed if
   Resend is configured).
4. **Accept (app)** — pull down to refresh: "A doctor invited you" → *Accept*. (Or tap the 🔔 and type the code.)
5. **Assign a varied program (portal)** — refresh the roster → *Assign program* → *Add the first exercise*. A good
   mix (two tilt-tracked, two rotation-tracked, all seated/standing, no equipment):

   | Exercise | Suggested | Tracking | Phone position |
   |---|---|---|---|
   | Shoulder Flexion | 2 × 5 | tilt | in the exercising hand, screen facing your body |
   | Seated Knee Straightening | 1 × 5 | tilt | in a snug sock/ankle band on the front of the shin |
   | Shoulder Circles | 1 × 3 | rotation | held loosely in the exercising hand |
   | Seated Trunk Twist | 1 × 4 | rotation | flat against your chest under crossed arms |

   New exercises default to every day, so they're due today. Set sets/reps in the boxes, then *Save program* — the
   banner confirms "Jordan will see 4 exercises in the app today". (Optional: toggle a day off on one exercise to
   show scheduling, or drag one up with the arrows.)
6. **Do the session (app)** — pull down to refresh → *Start Today's Session* → *Start Exercise* → hold still for the
   3-second calibration → do the reps; the app counts them out loud. After each exercise the summary says
   "Saved. Your care team can see this session." → *Next: …*.
7. **Doctor sees it (portal)** — refresh: roster shows *On track*, adherence and *Last session: Today*; open the
   patient for streak, adherence and the Recent sessions table (reps, average range of motion, time).

## Backup: ready-made demo accounts

If sign-up or email misbehaves, create already-confirmed accounts that are linked (and optionally have the program
above) — run from `backend/` with the Supabase secret key:

```bash
export SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SECRET_KEY=sb_secret_...
python scripts/demo_setup.py --doctor dr.lee@example.com --patient jordan@example.com --password demo-pass-123
# or --no-program to link only and assign the exercises live in step 5
```

## What was tested (Nov 4)

Run end to end against a local Supabase-equivalent stack (Postgres 16 with all 7 migrations + Supabase Auth +
PostgREST) with the real Flask backend, the real portal in Chromium, and the patient app's Expo web build:
doctor sign-up → patient sign-up + email confirmation → invite → in-app accept → program assigned through the portal
UI (validation, reorder, day toggles, reload) → patient dashboard → all 5 exercises completed with simulated
iPhone sensor data (every set and rep counted, sessions saved) → streak/adherence/sessions in the portal. All 20
library exercises were also run through the tracking engine and counted every rep. Backend: 51 pytest tests;
`tests_rls.sql` all passing.
