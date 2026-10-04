"use client";

import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
} from "firebase/ai";

import { getFirebaseApp, getFirebaseAppCheck } from "./client";
import {
  GEMINI_TUTOR_MODEL,
  GEMINI_FALLBACK_MODEL,
} from "./models";

const app = getFirebaseApp();
// AI Logic captures the App Check provider during initialization.
getFirebaseAppCheck();

const ai = getAI(app, {
  backend: new GoogleAIBackend(),
});

export const meowAIModel = getGenerativeModel(ai, {
  model: GEMINI_TUTOR_MODEL,
});

export const fallbackAIModel = getGenerativeModel(ai, {
  model: GEMINI_FALLBACK_MODEL,
});
