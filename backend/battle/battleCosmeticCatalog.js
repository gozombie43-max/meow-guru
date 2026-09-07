export const BATTLE_COSMETICS = {
  "title-challenger": { code: "title-challenger", type: "title", name: "Challenger", text: "Challenger" }, "title-contender": { code: "title-contender", type: "title", name: "Contender", text: "Contender" }, "title-elite": { code: "title-elite", type: "title", name: "Elite Competitor", text: "Elite Competitor" },
  "badge-season-warrior": { code: "badge-season-warrior", type: "badge", name: "Season Warrior", icon: "shield" }, "badge-precision": { code: "badge-precision", type: "badge", name: "Precision", icon: "target" }, "badge-veteran": { code: "badge-veteran", type: "badge", name: "Veteran", icon: "medal" },
  "frame-silver-ring": { code: "frame-silver-ring", type: "frame", name: "Silver Ring" }, "frame-gold-ring": { code: "frame-gold-ring", type: "frame", name: "Gold Ring" }, "frame-season-master": { code: "frame-season-master", type: "frame", name: "Season Master" },
};
export const getBattleCosmetic = (code) => BATTLE_COSMETICS[String(code)] || null;
