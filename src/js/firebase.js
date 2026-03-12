// src/js/firebase.js — Firebase initialization
// Uses Firebase SDK v10 (modular) imported from the CDN.
// This file is loaded as type="module" in app.html.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ─── Firebase Project Configuration ───────────────────────────────────────────
// Replace these placeholder values with your own Firebase project's config.
// How to get them:
//   1. Go to https://console.firebase.google.com
//   2. Open your project → Project Settings (gear icon)
//   3. Scroll down to "Your apps" → Web app → "Firebase SDK snippet"
//   4. Copy the firebaseConfig object values into the fields below.
//
// These values are safe to expose in frontend code.
// Firebase Security Rules (firestore.rules) protect your data.
// const firebaseConfig = {
//   apiKey: 'REPLACE_WITH_YOUR_FIREBASE_API_KEY',
//   authDomain: 'REPLACE_WITH_YOUR_AUTH_DOMAIN',         // e.g. your-project.firebaseapp.com
//   projectId: 'REPLACE_WITH_YOUR_PROJECT_ID',           // e.g. fluffy-music-12345
//   storageBucket: 'REPLACE_WITH_YOUR_STORAGE_BUCKET',   // e.g. your-project.appspot.com
//   messagingSenderId: 'REPLACE_WITH_YOUR_SENDER_ID',    // numeric string
//   appId: 'REPLACE_WITH_YOUR_APP_ID',                   // e.g. 1:123456:web:abcdef
// };
 const firebaseConfig = {
    apiKey: "AIzaSyASjSEPT80D9NOKgq71s_wkHAxiCbgBIv8",
    authDomain: "fluffy-music-86492.firebaseapp.com",
    projectId: "fluffy-music-86492",
    storageBucket: "fluffy-music-86492.firebasestorage.app",
    messagingSenderId: "701006425286",
    appId: "1:701006425286:web:a97c18ea82fd2238743bc7",
    measurementId: "G-BZWDWCYZNS"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export service instances
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Request user's email and profile when they log in
googleProvider.addScope('profile');
googleProvider.addScope('email');
