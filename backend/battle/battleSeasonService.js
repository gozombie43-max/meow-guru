import { getBattleSeasonsCollection } from "../config/mongodb.js";

export async function getActiveBattleSeason(now = new Date()) {
  return getBattleSeasonsCollection().findOne({
    status: "active",
    startsAt: { $lte: now },
    endsAt: { $gt: now },
  });
}

export async function getBattleSeason(seasonKey) {
  if (!seasonKey) return null;
  return getBattleSeasonsCollection().findOne({ key: String(seasonKey) });
}
