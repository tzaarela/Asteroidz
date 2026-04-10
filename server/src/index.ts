import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@asteroidz/shared';
import { createLobby, joinLobby, leaveLobby, startMatch, handleDisconnect, getPlayerLobbyCode, handleKill, isLobbyLeader } from './game/lobbyManager.js';

const PORT = process.env.PORT ?? 3000;
const isProd = process.env.NODE_ENV === 'production';

const app = express();
const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: isProd ? false : 'http://localhost:5173',
  },
});

if (isProd) {
  app.use(express.static(path.resolve(__dirname, '../../client/dist')));
  app.get('/game/:lobbyCode', (_req, res) => {
    res.sendFile(path.resolve(__dirname, '../../client/dist/index.html'));
  });
} else {
  app.get('/game/:lobbyCode', (req, res) => {
    res.redirect(`http://localhost:${process.env['VITE_PORT'] ?? 5173}/game/${req.params.lobbyCode}`);
  });
}

io.on('connection', (socket) => {
  console.log(`client connected: ${socket.id}`);

  socket.on('lobby:create', ({ name }) => createLobby(socket, name));
  socket.on('lobby:join', ({ lobbyId, name }) => joinLobby(socket, lobbyId, name));
  socket.on('lobby:leave', () => leaveLobby(socket, io));
  socket.on('lobby:start', () => startMatch(socket, io));
  socket.on('disconnect', () => handleDisconnect(socket, io));

  socket.on('player:update', (transform) => {
    const lobbyCode = getPlayerLobbyCode(socket.id);
    if (!lobbyCode) return;
    socket.to(lobbyCode).emit('player:update', { playerId: socket.id, ...transform });
  });

  socket.on('player:shoot', (payload) => {
    const lobbyCode = getPlayerLobbyCode(socket.id);
    if (!lobbyCode) return;
    socket.to(lobbyCode).emit('player:shoot', { playerId: socket.id, ...payload });
  });

  socket.on('arena:destroy', ({ chunkId }) => {
    const lobbyCode = getPlayerLobbyCode(socket.id);
    if (!lobbyCode) return;
    socket.to(lobbyCode).emit('arena:destroy', { chunkId, destroyerId: socket.id });
  });

  socket.on('asteroid:destroyed', ({ asteroidId }) => {
    const lobbyCode = getPlayerLobbyCode(socket.id);
    if (!lobbyCode) return;
    socket.to(lobbyCode).emit('asteroid:destroyed', { asteroidId, destroyerId: socket.id });
  });

  socket.on('player:hit', ({ targetId }) => handleKill(socket, io, targetId));

  socket.on('player:respawn', ({ x, y }) => {
    const lobbyCode = getPlayerLobbyCode(socket.id);
    if (!lobbyCode) return;
    io.to(lobbyCode).emit('player:respawn', { playerId: socket.id, x, y });
  });

  socket.on('pickup:spawn', (payload) => {
    if (!isLobbyLeader(socket.id)) return;
    const lobbyCode = getPlayerLobbyCode(socket.id);
    if (!lobbyCode) return;
    socket.to(lobbyCode).emit('pickup:spawn', payload);
  });

  socket.on('pickup:collected', ({ pickupId, type }) => {
    const lobbyCode = getPlayerLobbyCode(socket.id);
    if (!lobbyCode) return;
    socket.to(lobbyCode).emit('pickup:collected', { pickupId, collectorId: socket.id, type });
  });
});

httpServer.listen(PORT, () => {
  console.log(`listening on port ${PORT}`);
});
