// Auth pages can synchronously clean up an existing socket without importing
// the Socket.IO client. Feature code registers cleanup when it loads the client.
let disconnect: (() => void) | undefined;
export function registerSocketDisconnect(callback: () => void) { disconnect = callback; }
export function disconnectSocket() { disconnect?.(); }
