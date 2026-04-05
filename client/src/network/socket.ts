import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@asteroidz/shared';

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function connect(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (socket?.connected) return socket;

  socket = io({ autoUnref: false });

  socket.on('connect', () => {
    console.log('[socket] connected:', socket?.id);
  });

  socket.on('connect_error', (err) => {
    console.error('[socket] connection error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.warn('[socket] disconnected:', reason);
  });

  return socket;
}

export function disconnect(): void {
  socket?.disconnect();
  socket = null;
}

export function emit<Ev extends keyof ClientToServerEvents>(
  event: Ev,
  ...args: Parameters<ClientToServerEvents[Ev]>
): void {
  if (!socket?.connected) {
    console.warn('[socket] emit called but socket is not connected');
    return;
  }
  socket.emit(event, ...args);
}

export function on<Ev extends keyof ServerToClientEvents>(
  event: Ev,
  callback: ServerToClientEvents[Ev],
): void {
  socket?.on(event, callback as never);
}

export function off<Ev extends keyof ServerToClientEvents>(
  event: Ev,
  callback: ServerToClientEvents[Ev],
): void {
  socket?.off(event, callback as never);
}

export function getSocketId(): string | undefined {
  return socket?.id;
}
