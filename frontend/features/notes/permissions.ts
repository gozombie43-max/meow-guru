export const canManageNotes = (role?: string) => role === 'admin' || role === 'superadmin';
