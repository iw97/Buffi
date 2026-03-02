# Cyni (Next.js)

Cyni — Next.js 14 (App Router) + Tailwind CSS + Firebase (Auth + Firestore).

## Getting started

```bash
cd cyni
npm install
cp .env.example .env.local
# Edit .env.local with your Firebase project config (see below)
npm run dev
```

## Firebase setup

1. Create a project in [Firebase Console](https://console.firebase.google.com).
2. Enable **Authentication** → sign-in methods: **Google** and **Email/Password**.
3. Create a **Firestore** database.
4. In Project settings → General, add a web app and copy the config into `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

5. Deploy Firestore rules and indexes (optional; the first query will prompt you to create the index via console):

```bash
firebase deploy --only firestore
```

Or copy `firestore.rules` and `firestore.indexes.json` into your Firebase project and deploy from the console.

## Routes (prototype screens)

- `/` (Splash)
- `/onboarding/values`
- `/onboarding/priorities`
- `/onboarding/budget`
- `/onboarding/account`
- `/scan`
- `/analyzing`
- `/breakdown`
- `/saves`
- `/profile`
- `/faq`

