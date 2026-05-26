# 🧠 Brain Scan Demo Data — Quick Start Guide

## 🎯 The Problem You Had
> "Show data using my till current try questions without completing quiz"

## ✅ The Solution
We added **3 ways** to populate demo data instantly:

---

## 🚀 **OPTION 1: Click Button** (EASIEST - DO THIS FIRST!)

### Steps:
1. Go to: https://brave-island-0a237e400.6.azurestaticapps.net/dashboard
2. Look for section titled: **"Complete at least 3 quizzes to unlock your Brain Scan"**
3. Click button: **🧪 View Demo Data**
4. 💥 **BOOM** — Dashboard populates with sample data

### What Happens:
- ✅ 9 sample concepts load
- ✅ Shows failure breakdown across 5 dimensions
- ✅ Displays top weak concepts with prescribed drills
- ✅ Data persists on page refresh

---

## 💻 **OPTION 2: Browser Console**

### Steps:
1. Open DevTools: **F12** (or Ctrl+Shift+I)
2. Go to **Console** tab
3. Paste this code:

```javascript
fetch("/api/agent/seed-demo-data", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ userId: localStorage.getItem("userId") })
})
.then(r => r.json())
.then(c => console.log("✅ Demo data seeded!", c) || location.reload());
```

4. Press **Enter**
5. Page auto-refreshes with demo data

### What You'll See in Console:
```
✅ Demo data seeded! {
  success: true,
  conceptsSeeded: 9,
  totalFailuresSeeded: 26,
  ...
}
```

---

## ⚙️ **OPTION 3: Backend CLI**

### Steps:
```bash
# Get your userId first (from dashboard or network tab)
# Then run:
node scripts/seed-brain-scan-demo.js YOUR_USER_ID --url https://brave-island-0a237e400.6.azurestaticapps.net
```

### Example:
```bash
node scripts/seed-brain-scan-demo.js "user-abc-123" --url https://brave-island-0a237e400.6.azurestaticapps.net
```

### Output:
```
🧠 Seeding demo data for user: user-abc-123
📡 API URL: https://brave-island-0a237e400.6.azurestaticapps.net
✅ Demo data seeded successfully
   📊 Concepts seeded: 9
   ❌ Total failures: 26

🎯 Now visit: https://brave-island-0a237e400.6.azurestaticapps.net/dashboard to see your Brain Scan!
```

---

## 📊 What Demo Data Includes

### 9 Concepts | 26 Failures | All Dimensions

```
🗂️ MIRROR IMAGES
  📚 Clock Face Rotation (4 failures)
  ⚙️ Shape Reflection (3 failures)
  🪤 Pattern Recognition (2 failures)

🗂️ ANALOGY
  📚 Word Relations (3 failures)
  ⏱️ Synonym Pairs (2 failures)

🗂️ CLASSIFICATION
  👁️ Category Grouping (5 failures)
  🪤 Odd One Out (1 failure)

🗂️ MATHEMATICS
  ⚙️ Percentage Calculations (4 failures)
  📚 Profit & Loss (2 failures)
```

### Failure Dimension Breakdown:
- 📚 **Conceptual Gap**: 9 failures (35%)
- ⚙️ **Application Error**: 7 failures (27%)
- 🪤 **Trap Caught**: 3 failures (12%)
- ⏱️ **Speed Panic**: 2 failures (8%)
- 👁️ **Blind Spot**: 5 failures (19%)

---

## 👀 What You'll See

### On Dashboard:
1. **Failure Pattern Overview** — 5 colored bars (one per dimension)
2. **Top Weak Concepts** — Cards showing:
   - Concept name
   - Number of wrong answers
   - Breakdown by dimension
   - Recommended drill type

### Example Card:
```
┌─────────────────────────────────────┐
│ Mirror Images                       │
│ Clock Face Rotation            📚   │
│                                     │
│ 4 wrong answers tracked             │
│                                     │
│ 📚 4  🪤 0  ⏱️ 0  ⚙️ 0  👁️ 0        │
│                                     │
│ 💡 Prescribed drill:                │
│ Study the concept first, then       │
│ do 10 easy questions.               │
└─────────────────────────────────────┘
```

---

## ✨ Features

| Feature | Status |
|---------|--------|
| **View without 3 quizzes** | ✅ Yes |
| **Click button to seed** | ✅ Yes |
| **Data persists** | ✅ Yes (Cosmos DB) |
| **No LLM cost** | ✅ Free (no Claude calls) |
| **Mobile friendly** | ✅ Responsive |
| **Works on live site** | ✅ Yes |

---

## 🔍 Verify It Worked

### Check in Browser Console:
```javascript
// Should show user's profile with demo data
fetch('/api/agent/brain-scan/' + localStorage.getItem('userId'))
  .then(r => r.json())
  .then(d => console.log(d));

// Output should show:
// {
//   topWeakConcepts: [...],
//   globalDistribution: {...},
//   totalConceptsTracked: 9,
//   hasSufficientData: true,
//   ...
// }
```

### On Dashboard:
- ✅ Brain Scan section no longer shows "Complete at least 3 quizzes"
- ✅ Shows dimension bars with percentages
- ✅ Shows top weak concepts cards
- ✅ All colors and emojis render correctly

---

## 🚀 Next Steps

After testing demo data:

1. **Take a real quiz** on the site
2. **Mark answers wrong** on purpose (at least 3 different concepts)
3. **Watch Brain Scan auto-update** with your real data
4. **Compare** with demo to verify real system works
5. **Provide feedback** on drill recommendations

---

## ❓ Troubleshooting

### "Button doesn't appear"
→ Refresh page, make sure you're logged in

### "API error when seeding"
→ Check browser console for error details
→ Verify userId is correct: `localStorage.getItem('userId')`

### "Data doesn't show after seeding"
→ Try manual refresh: F5
→ Or click "View Demo Data" button again

### "Console pasting doesn't work"
→ Try Option 1 (button) or Option 3 (CLI) instead

---

## 📚 Full Documentation

For detailed info, see:
- **BRAIN_SCAN_TESTING.md** — Comprehensive guide
- **DEMO_DATA_SETUP.md** — Technical reference

---

**Ready?** 👉 [Go to Dashboard](https://brave-island-0a237e400.6.azurestaticapps.net/dashboard)
