"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
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

let _app: FirebaseApp | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (!_app) {
    _app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  return _app;
}

export const firebaseApp = new Proxy({} as FirebaseApp, {
  get(_target, prop) {
    const app = getFirebaseApp();
    return (app as unknown as Record<string | symbol, unknown>)[prop];
  },
});

type AppCheckGlobal = typeof globalThis & {
  FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
  __meowAppCheck?: AppCheck;
};

const appCheckGlobal = globalThis as AppCheckGlobal;

export function getFirebaseAppCheck(): AppCheck | undefined {
  if (typeof window === "undefined") return undefined;
  if (!appCheckGlobal.__meowAppCheck) {
    if (process.env.NODE_ENV === "development") {
      const envToken = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN;
      const sessionToken = window.sessionStorage?.getItem("__firebase_appcheck_debug_token");
      appCheckGlobal.FIREBASE_APPCHECK_DEBUG_TOKEN = envToken || sessionToken || true;
    }

    const siteKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;
    if (siteKey) {
      appCheckGlobal.__meowAppCheck = initializeAppCheck(
        getFirebaseApp(),
        {
          provider: new ReCaptchaEnterpriseProvider(siteKey),
          isTokenAutoRefreshEnabled: true,
        }
      );
    } else if (process.env.NODE_ENV === "production") {
      throw new Error("Missing NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY");
    }
  }
  return appCheckGlobal.__meowAppCheck;
}

export const firebaseAppCheck = new Proxy({} as AppCheck, {
  get(_target, prop) {
    const check = getFirebaseAppCheck();
    return check ? (check as unknown as Record<string | symbol, unknown>)[prop] : undefined;
  },
});