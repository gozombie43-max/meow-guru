// frontend/lib/socket.ts
// Socket.IO connects DIRECTLY to the Azure backend — NOT through the Vercel /backend-api proxy.
// Vercel rewrites are HTTP-only and do not support WebSocket upgrades.
// REST APIs still use NEXT_PUBLIC_API_URL (/backend-api/*) as before.
import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './axios';

let socket: Socket | null = null;

// Direct Azure backend URL — bypasses the Vercel proxy for WebSocket support.
// Must be set in Vercel Environment Variables as NEXT_PUBLIC_SOCKET_URL.
// NOTE: NEXT_PUBLIC_API_URL is intentionally NOT in this fallback chain.
//   In production it equals "/backend-api" (Vercel rewrite) which has no WebSocket support.
//   A missing NEXT_PUBLIC_SOCKET_URL will fall back to localhost and fail loudly,
//   rather than silently routing through the proxy.
const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  'http://localhost:10000';

export function getSocket(customToken?: string): Socket {
  const token = customToken || getAccessToken();

  if (!socket) {
    socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      autoConnect: true,
      auth: (cb) => {
        const activeToken = getAccessToken();
        cb({ token: activeToken });
      },
    });
  } else if (token) {
    socket.auth = { token };
    if (!socket.connected) {
      socket.connect();
    }
  }

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
