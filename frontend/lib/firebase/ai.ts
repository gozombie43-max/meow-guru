"use client";

import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
} from "firebase/ai";

import { firebaseApp } from "./client";

const ai = getAI(firebaseApp, {
  backend: new GoogleAIBackend(),
});

export const meowAIModel = getGenerativeModel(ai, {
  model: "gemini-3.8-flash",
});

export const fallbackAIModel = getGenerativeModel(ai, {
  model: "gemini-3.7-flash",
});