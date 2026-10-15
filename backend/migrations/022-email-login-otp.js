export const id = '022-email-login-otp';

export async function up(db) {
  await db.collection('emailLoginChallenges').createIndex(
    { cleanupAt: 1 }, { name: 'email_login_challenge_cleanup', expireAfterSeconds: 0 },
  );
}
