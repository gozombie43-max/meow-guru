export const id = '006-oauth-state';
export async function up(db) {
  await db.collection('oauthStates').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'oauth_state_expiry' });
}
