import { query } from "./_generated/server";

export const whoAmI = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return null;
    }

    return {
      userId: identity.subject,
      issuer: identity.issuer,
      email: identity.email ?? null,
      name: identity.name ?? null,
    };
  },
});
