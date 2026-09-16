"use client";

import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
} from "firebase/ai";

import { firebaseApp } from "./client";
import {
  GEMINI_TUTOR_MODEL,
  GEMINI_FALLBACK_MODEL,
} from "./models";

const ai = getAI(firebaseApp, {
  backend: new GoogleAIBackend(),
});

export const meowAIModel = getGenerativeModel(ai, {
  model: GEMINI_TUTOR_MODEL,
});

export const fallbackAIModel = getGenerativeModel(ai, {
  model: GEMINI_FALLBACK_MODEL,
});