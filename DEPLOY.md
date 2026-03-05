# Buffi — Run & Deploy

How to run Buffi locally and deploy to Netlify.

---

## Run locally

1. **Go to the project folder**
   ```bash
   cd buffi
   ```
   (If your folder is named something else, use that name.)

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment**
   - Copy `.env.example` to `.env.local`.
   - Fill in your Firebase config (see README for Firebase setup).
   ```bash
   cp .env.example .env.local
   ```

4. **Start dev server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

5. **Production build (optional)**
   ```bash
   npm run build
   npm run start
   ```

---

## Deploy to Netlify

1. **Push Buffi to a Git repo** (GitHub, GitLab, or Bitbucket) if you haven’t already.

2. **Add the site in Netlify**
   - Go to [netlify.com](https://www.netlify.com) and sign in.
   - **Add new site** → **Import an existing project** and connect your repo.
   - Netlify will detect Next.js; build command and publish directory are set via `netlify.toml` and `@netlify/plugin-nextjs`.

3. **Environment variables**
   - In the site → **Site configuration** → **Environment variables**, add the same vars as in `.env.local`:
     - `NEXT_PUBLIC_FIREBASE_API_KEY`
     - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
     - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
     - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
     - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
     - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - Also set `ANTHROPIC_API_KEY` for the `/api/scan` route (Claude).
   - Apply to **Production** (and other contexts if needed).

4. **Function timeout for `/api/scan`**
   - The scan API calls Claude and can take 15+ seconds. Netlify’s default function timeout is 10 seconds.
   - In Netlify: **Site configuration** → **Build & deploy** → **Continuous deployment** → **Build settings** → **Edit settings** → **Post processing** (or **Functions**), set **Function timeout** to at least **15** seconds (Pro accounts can request up to 26 seconds from support if needed).

5. **Deploy**
   - Trigger a deploy (e.g. push to the production branch). Netlify will run `npm run build` and use the Next.js plugin to build and deploy the app and API routes.

---

## Firestore in production

- Deploy Firestore rules and indexes from your Firebase project (see README).
- In Firebase Console, add your Netlify domain (e.g. `your-site.netlify.app`) to **Authentication** → **Authorized domains** so sign-in works in production.
