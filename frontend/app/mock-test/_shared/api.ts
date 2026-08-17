const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function getHeaders(token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function getAdminHeaders(adminSecret: string) {
  return {
    'Content-Type': 'application/json',
    'x-admin-secret': adminSecret,
  };
}

// ─── Slot Endpoints ───────────────────────────────────────

export async function getExamSlots(examSlug: string) {
  const res = await fetch(`${BASE}/api/mocktest/${examSlug}/slots`);
  if (!res.ok) throw new Error(`Failed to fetch slots for ${examSlug}`);
  return res.json(); // returns { slots: MockTestSlot[] }
}

export async function getSlotDetails(slotId: string, examSlug?: string) {
  const query = examSlug ? `?examSlug=${encodeURIComponent(examSlug)}` : '';
  const res = await fetch(`${BASE}/api/mocktest/slots/${slotId}${query}`);
  if (!res.ok) throw new Error(`Failed to fetch slot ${slotId}`);
  return res.json(); // returns { slot: MockTestSlot }
}

// ─── Admin Slot Management Endpoints ──────────────────────

export async function adminCreateSlot(slotData: any, adminSecret: string) {
  const res = await fetch(`${BASE}/api/mocktest/admin/slots`, {
    method: 'POST',
    headers: getAdminHeaders(adminSecret),
    body: JSON.stringify(slotData),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to create slot');
  }
  return res.json();
}

export async function adminUpdateSlot(slotId: string, examSlug: string, updates: any, adminSecret: string) {
  const res = await fetch(`${BASE}/api/mocktest/admin/slots/${slotId}`, {
    method: 'PATCH',
    headers: getAdminHeaders(adminSecret),
    body: JSON.stringify({ examSlug, ...updates }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to update slot');
  }
  return res.json();
}

export async function adminDeleteSlot(slotId: string, examSlug: string, adminSecret: string) {
  const res = await fetch(`${BASE}/api/mocktest/admin/slots/${slotId}?examSlug=${encodeURIComponent(examSlug)}`, {
    method: 'DELETE',
    headers: getAdminHeaders(adminSecret),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to delete slot');
  }
  return res.json();
}

export async function adminSeedSlots(adminSecret: string) {
  const res = await fetch(`${BASE}/api/mocktest/admin/slots/seed`, {
    method: 'POST',
    headers: getAdminHeaders(adminSecret),
  });
  if (!res.ok) throw new Error('Failed to seed default slots');
  return res.json();
}

// ─── Test Attempt Endpoints ───────────────────────────────

export async function startTest(examSlug: string, testId: string, token: string) {
  const res = await fetch(`${BASE}/api/mocktest/${examSlug}/${testId}/start`, {
    method: 'POST',
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to start test');
  return res.json();
}

export async function autosaveAttempt(attemptId: string, data: any, token: string) {
  const res = await fetch(`${BASE}/api/mocktest/attempt/${attemptId}/autosave`, {
    method: 'PATCH',
    headers: getHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to autosave');
  return res.json();
}

export async function submitAttempt(attemptId: string, token: string) {
  const res = await fetch(`${BASE}/api/mocktest/attempt/${attemptId}/submit`, {
    method: 'POST',
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to submit test');
  return res.json();
}

export async function getAttempt(attemptId: string, token: string) {
  const res = await fetch(`${BASE}/api/mocktest/attempt/${attemptId}`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to get attempt');
  return res.json();
}

export async function getTestHistory(examSlug: string, testId: string, token: string) {
  const res = await fetch(`${BASE}/api/mocktest/${examSlug}/${testId}/history`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to fetch test history');
  return res.json();
}

export async function getExamHistory(examSlug: string, token: string) {
  const res = await fetch(`${BASE}/api/mocktest/${examSlug}/history`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to fetch exam history');
  return res.json();
}
