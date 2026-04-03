import type { Socket, Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@asteroidz/shared';
import { MatchPhase } from '@asteroidz/shared';
import type { LobbyState, PlayerInfo } from '@asteroidz/shared';

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type GameServer = Server<ClientToServerEvents, ServerToClientEvents>;

const lobbies = new Map<string, LobbyState>();

// Maps socket.id → lobby code for quick lookup on leave/disconnect
const socketToLobby = new Map<string, string>();

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function createLobby(socket: GameSocket, name: string, color: string): void {
  // Generate a unique code (retry on collision)
  let code = generateCode();
  while (lobbies.has(code)) {
    code = generateCode();
  }

  const player: PlayerInfo = { id: socket.id, name, color };

  const lobby: LobbyState = {
    code,
    players: [player],
    leaderId: socket.id,
    matchPhase: MatchPhase.Warmup,
  };

  lobbies.set(code, lobby);
  socketToLobby.set(socket.id, code);

  void socket.join(code);
  socket.emit('lobby:state', lobby);

  console.log(`lobby created: ${code} by ${name} (${socket.id})`);
}

export function joinLobby(socket: GameSocket, lobbyId: string, name: string, color: string): void {
  const code = lobbyId.toUpperCase();
  const lobby = lobbies.get(code);

  if (!lobby) {
    console.log(`lobby:join failed — unknown code: ${code} (socket: ${socket.id})`);
    return;
  }

  // Prevent double-join
  if (socketToLobby.has(socket.id)) {
    console.log(`lobby:join ignored — socket ${socket.id} already in a lobby`);
    return;
  }

  const player: PlayerInfo = { id: socket.id, name, color };
  lobby.players.push(player);
  socketToLobby.set(socket.id, code);

  void socket.join(code);
  // Broadcast updated state to everyone in the room (including the new joiner)
  socket.to(code).emit('lobby:state', lobby);
  socket.emit('lobby:state', lobby);

  console.log(`${name} (${socket.id}) joined lobby: ${code}`);
}

export function leaveLobby(socket: GameSocket, io: GameServer): void {
  const code = socketToLobby.get(socket.id);
  if (!code) return;

  const lobby = lobbies.get(code);
  if (!lobby) {
    socketToLobby.delete(socket.id);
    return;
  }

  lobby.players = lobby.players.filter((p) => p.id !== socket.id);
  socketToLobby.delete(socket.id);
  void socket.leave(code);

  if (lobby.players.length === 0) {
    lobbies.delete(code);
    console.log(`lobby ${code} deleted — no players remaining`);
    return;
  }

  // Reassign leader if needed
  if (lobby.leaderId === socket.id) {
    lobby.leaderId = lobby.players[0].id;
    console.log(`lobby ${code} — leader reassigned to ${lobby.leaderId}`);
  }

  io.to(code).emit('lobby:state', lobby);
}

export function handleDisconnect(socket: GameSocket, io: GameServer): void {
  leaveLobby(socket, io);
}
