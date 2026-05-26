#!/usr/bin/env node

/**
 * Seed Brain Scan Demo Data
 * Usage: node scripts/seed-brain-scan-demo.js <userId> [--url http://localhost:3000]
 */

import axios from "axios";

const args = process.argv.slice(2);
const userId = args[0];
const url = args.find((a) => a.startsWith("--url"))?.split("=")[1] || "http://localhost:3000";

if (!userId) {
  console.error("❌ Usage: node scripts/seed-brain-scan-demo.js <userId> [--url http://localhost:3000]");
  process.exit(1);
}

console.log(`🧠 Seeding demo data for user: ${userId}`);
console.log(`📡 API URL: ${url}`);

axios
  .post(`${url}/api/agent/seed-demo-data`, { userId })
  .then((res) => {
    const { success, conceptsSeeded, totalFailuresSeeded, message } = res.data;
    if (success) {
      console.log(`✅ ${message}`);
      console.log(`   📊 Concepts seeded: ${conceptsSeeded}`);
      console.log(`   ❌ Total failures: ${totalFailuresSeeded}`);
      console.log(`\n🎯 Now visit: ${url}/dashboard to see your Brain Scan!`);
    } else {
      console.error("❌ Error:", res.data.error);
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error("❌ Error seeding data:", err.response?.data?.error || err.message);
    process.exit(1);
  });
