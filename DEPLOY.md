# Recit — Run & Deploy

How to run Recit locally and deploy to Vercel. No Jiria references; this doc is for the Recit app only.

---

## Run locally

1. **Go to the project folder**
   ```bash
   cd recit
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

## Deploy to Vercel

1. **Push Recit to a Git repo** (GitHub, GitLab, or Bitbucket) if you haven’t already.

2. **Import in Vercel**
   - Go to [vercel.com](https://vercel.com) and sign in.
   - **Add New** → **Project** and import your Recit repo.
   - Framework: **Next.js** (auto-detected). Root directory: leave as repo root (or set to the folder that contains `package.json` if the repo is a monorepo).

3. **Environment variables**
   - In the project → **Settings** → **Environment Variables**, add the same vars as in `.env.local`:
     - `NEXT_PUBLIC_FIREBASE_API_KEY`
     - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
     - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
     - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
     - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
     - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - Apply to **Production** (and Preview if you want).

4. **Deploy**
   - Click **Deploy**. Vercel will run `npm run build` and host the app.
   - Optional: connect the repo so every push to your main branch triggers a new deployment.

---

## Firestore in production

- Deploy Firestore rules and indexes from your Firebase project (see README).
- In Firebase Console, add your Vercel domain (e.g. `your-app.vercel.app`) to **Authentication** → **Authorized domains** so sign-in works in production.
