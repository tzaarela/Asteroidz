import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const PORT = process.env.PORT ?? 3000;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

// In production, serve the bundled client
app.use(express.static('../client/dist'));

io.on('connection', (socket) => {
  console.log(`client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`client disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`listening on port ${PORT}`);
});
