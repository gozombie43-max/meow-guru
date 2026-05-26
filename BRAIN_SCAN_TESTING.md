# Brain Scan Dashboard — Testing Guide

## Quick Start (3 Ways to Test)

### 1️⃣ **Frontend Button (Easiest — Recommended)**
- Go to `/dashboard`
- See: "Complete at least 3 quizzes to unlock your Brain Scan."
- Click: **"🧪 View Demo Data"** button
- Brain Scan Dashboard populates with 9 sample concepts across all failure dimensions
- ✅ No terminal, no API calls needed

### 2️⃣ **Browser Console (Dev-Friendly)**
- Open DevTools Console (F12)
- Paste:
```javascript
fetch("/api/agent/seed-demo-data", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ userId: localStorage.getItem("userId") })
}).then(r => r.json()).then(c => {
  console.log("✅ Seeded:", c);
  window.location.reload(); // Refresh to see Brain Scan
});
```
- Press Enter
- Refresh page to see Brain Scan populated

### 3️⃣ **CLI Script (Backend Seeding)**
- Get your userId from dashboard or Network tab
- Run:
```bash
node scripts/seed-brain-scan-demo.js <userId> --url https://brave-island-0a237e400.6.azurestaticapps.net
```
- Example:
```bash
node scripts/seed-brain-scan-demo.js "user-123" --url https://brave-island-0a237e400.6.azurestaticapps.net
```

---

## What Demo Data Includes

**9 Concepts across 4 topics with 26 total tracked failures:**

| Topic | Concept | Dimension | Count |
|-------|---------|-----------|-------|
| Mirror Images | Clock Face Rotation | CONCEPTUAL_GAP | 4 |
| Mirror Images | Shape Reflection | APPLICATION_ERROR | 3 |
| Mirror Images | Pattern Recognition | TRAP_CAUGHT | 2 |
| Analogy | Word Relations | CONCEPTUAL_GAP | 3 |
| Analogy | Synonym Pairs | SPEED_PANIC | 2 |
| Classification | Category Grouping | BLIND_SPOT | 5 |
| Classification | Odd One Out | TRAP_CAUGHT | 1 |
| Mathematics | Percentage Calculations | APPLICATION_ERROR | 4 |
| Mathematics | Profit & Loss | CONCEPTUAL_GAP | 2 |

---

## What You'll See

### Dimension Breakdown
- **Conceptual Gap (📚)**: 9 failures — "You need to learn the rules"
- **Application Error (⚙️)**: 7 failures — "Know concepts, but make execution errors"
- **Trap Caught (🪤)**: 3 failures — "SSC's traps fooling you"
- **Speed Panic (⏱️)**: 2 failures — "Changing correct answers"
- **Blind Spot (👁️)**: 5 failures — "Skipping / guessing patterns"

### Top Weak Concepts (Sorted by totalWrong)
1. **Classification :: Category Grouping** — 5 wrong (Dominant: Blind Spot)
2. **Mirror Images :: Clock Face Rotation** — 4 wrong (Dominant: Conceptual Gap)
3. **Mathematics :: Percentage Calculations** — 4 wrong (Dominant: Application Error)
... and more

### Prescribed Drills
Each concept card shows a tailored drill recommendation based on its dominant failure dimension.

---

## Testing Endpoints

### Seed Demo Data
```bash
POST /api/agent/seed-demo-data
Content-Type: application/json

{ "userId": "user-123" }

Response:
{
  "success": true,
  "message": "Demo data seeded successfully",
  "userId": "user-123",
  "conceptsSeeded": 9,
  "totalFailuresSeeded": 26
}
```

### Fetch Brain Scan
```bash
GET /api/agent/brain-scan/:userId

Response:
{
  "topWeakConcepts": [...],
  "globalDistribution": { ... },
  "totalConceptsTracked": 9,
  "hasSufficientData": true,
  "lastActiveDate": 1234567890
}
```

---

## Verification Checklist

- [ ] **Component renders** — No "Component not found" errors
- [ ] **Demo button visible** — On empty Brain Scan state
- [ ] **Demo data seeds** — No API errors in console
- [ ] **Dashboard populates** — Shows dimension breakdown bars
- [ ] **Top weak concepts display** — Cards render with drill prescriptions
- [ ] **Responsive design** — Works on mobile (360px+) and desktop
- [ ] **Color coding** — Each dimension has correct color/emoji
- [ ] **Percentages calculate** — Sum to 100% (within rounding)

---

## Troubleshooting

### Button doesn't appear
→ Make sure `user.id` is defined in dashboard context

### "Cannot POST /api/agent/seed-demo-data"
→ Router not mounted. Check `backend/index.js` line 134

### Data doesn't persist after refresh
→ Check Cosmos DB connection; verify `getUsersContainer()` working

### Dashboard shows empty even after seeding
→ Try manual refresh: `fetchBrainScan()` in console

---

## Real Production Testing

Once demo data works:

1. **Complete a real quiz** on the site
2. **Mark 3+ questions wrong** with varied failure types
3. **Verify Brain Scan auto-updates** without demo button
4. **Compare with demo data** — production should look similar

---

## Next Steps

After verifying the visualization:
- Integrate `/tag-failure` endpoint into quiz completion flow
- Test real failure tagging during quiz progress
- Monitor Azure OpenAI API calls and costs
- Gather user feedback on drill recommendations
