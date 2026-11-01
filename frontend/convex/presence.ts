import { Presence } from "@convex-dev/presence";
import { components } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const presence = new Presence(components.presence);

const GLOBAL_ROOM_ID = "meow-global-v1";
const HEARTBEAT_INTERVAL_MS = 15_000;
const RECENT_ACTIVITY_LIMIT = 32;
const ONLINE_COUNT_SCAN_LIMIT = 1_000;

export const heartbeat = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    sessionId: v.string(),
    interval: v.number(),
  },
  returns: v.object({
    roomToken: v.string(),
    sessionToken: v.string(),
  }),
  handler: async (ctx, { roomId, userId, sessionId, interval }) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Authentication required.");
    }

    if (roomId !== GLOBAL_ROOM_ID || userId !== identity.subject) {
      throw new Error("Invalid student presence identity.");
    }

    if (
      sessionId.length < 1 ||
      sessionId.length > 200 ||
      !Number.isFinite(interval) ||
      interval < 5_000 ||
      interval > 30_000
    ) {
      throw new Error("Invalid student presence session.");
    }

    // The client cannot extend its own online lease by requesting a slower heartbeat.
    return presence.heartbeat(
      ctx,
      GLOBAL_ROOM_ID,
      identity.subject,
      sessionId,
      HEARTBEAT_INTERVAL_MS,
    );
  },
});

export const list = query({
  args: {
    roomToken: v.string(),
  },
  returns: v.array(
    v.object({
      userId: v.string(),
      online: v.boolean(),
      lastDisconnected: v.number(),
      data: v.optional(v.any()),
    }),
  ),
  handler: async (ctx, { roomToken }) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Authentication required.");
    }

    // The component orders active/recent users for the live activity view.
    return presence.list(ctx, roomToken, RECENT_ACTIVITY_LIMIT);
  },
});

export const onlineCount = query({
  args: {},
  returns: v.object({
    count: v.number(),
    capped: v.boolean(),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Authentication required.");
    }

    // One presence row per unique user per room, even with multiple tabs/devices.
    // This bounded first-release scan avoids returning the entire user list.
    const onlineUsers = await presence.listRoom(
      ctx,
      GLOBAL_ROOM_ID,
      true,
      ONLINE_COUNT_SCAN_LIMIT,
    );

    return {
      count: onlineUsers.length,
      capped: onlineUsers.length === ONLINE_COUNT_SCAN_LIMIT,
    };
  },
});

export const syncMyProfile = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Authentication required.");
    }

    // Use only the name signed by Azure in the ES256 JWT.
    // Never trust a browser-supplied name for a different account.
    const displayName = identity.name?.trim().slice(0, 64) || "Meow student";

    await presence.updateRoomUser(
      ctx,
      GLOBAL_ROOM_ID,
      identity.subject,
      { displayName },
    );

    return null;
  },
});

export const disconnect = mutation({
  args: {
    sessionToken: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { sessionToken }) => {
    // The component's opaque session token is required for sendBeacon on page unload.
    // The official component contract intentionally allows this operation without
    // an Authorization header; the token itself is a one-session capability.
    return presence.disconnect(ctx, sessionToken);
  },
});
