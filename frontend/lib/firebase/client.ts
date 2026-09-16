"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from "firebase/app-check";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

export const firebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

type AppCheckGlobal = typeof globalThis & {
  FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
  __meowAppCheck?: AppCheck;
};

const appCheckGlobal = globalThis as AppCheckGlobal;

export let firebaseAppCheck: AppCheck | undefined;

if (typeof window !== "undefined") {
  // Local development only.
  // Firebase will print a debug token in the browser console.
  if (process.env.NODE_ENV === "development") {
    const envToken = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN;
    const sessionToken = typeof window !== "undefined" ? window.sessionStorage?.getItem("__firebase_appcheck_debug_token") : null;
    appCheckGlobal.FIREBASE_APPCHECK_DEBUG_TOKEN = envToken || sessionToken || true;
  }

  const siteKey =
    process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;

  if (!siteKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY"
    );
  }

  if (!appCheckGlobal.__meowAppCheck) {
    appCheckGlobal.__meowAppCheck = initializeAppCheck(
      firebaseApp,
      {
        provider: new ReCaptchaEnterpriseProvider(siteKey),
        isTokenAutoRefreshEnabled: true,
      }
    );
  }

  firebaseAppCheck = appCheckGlobal.__meowAppCheck;
}