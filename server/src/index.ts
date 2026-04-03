import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@asteroidz/shared';

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
  app.use(express.static('../client/dist'));
}

io.on('connection', (socket) => {
  console.log(`client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`client disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`listening on port ${PORT}`);
});
