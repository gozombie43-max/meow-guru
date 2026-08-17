// frontend/lib/socket.ts
import { io, Socket } from 'socket.io-client';
import { AUTH_TOKEN_STORAGE_KEY } from './axios';

let socket: Socket | null = null;

const defaultApiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000';

export function getSocket(customToken?: string): Socket {
  const token = customToken || (typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) : null);

  if (!socket) {
    socket = io(defaultApiBase, {
      withCredentials: true,
      autoConnect: true,
      auth: (cb) => {
        const activeToken = typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) : null;
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