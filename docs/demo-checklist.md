# Demo checklist — doctor + patient + assigned exercises

The core demo: create a doctor account and a patient account, link them, have the doctor assign a few varied
exercises, and show the patient doing them on the iPhone with live motion tracking. About 5 minutes.

## Start everything (terminal commands)

You need three things running: the **backend** (Flask API), the **portal** (doctor website) and the **iPhone app**.
Commands are for macOS (the iPhone build needs a Mac with Xcode). Use one terminal window per app and leave each
one running. Start from the repo folder:

```bash
cd ~/path/to/PTHomeApp          # wherever you cloned it
git checkout demo-ready         # the branch with the patch applied
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
on the phone (first time, or after changing native settings — takes a few minutes):

```bash
npx expo run:ios --device       # pick your iPhone from the list
```

If Xcode complains about signing: open `ios/*.xcworkspace` in Xcode → the app target → *Signing & Capabilities* →
choose your Apple ID team, then run the command again. On the phone, if it says "Untrusted Developer": Settings →
General → VPN & Device Management → trust your Apple ID.

Every time after that (app already installed on the phone):

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