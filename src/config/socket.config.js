import { Server } from 'socket.io';
import { ENV } from './env.config.js';
import { logger } from './logger.config.js';
import { verifyToken } from '../utils/jwt.util.js';
import prisma from './prisma.js';
import { registerRealtimeEvents } from '../sockets/realtime.events.js';

let ioInstance = null;

/**
 * Initialize Socket.IO with HTTP Server, JWT Handshake Auth, and Default In-Memory Adapter
 */
export const initSocket = async (httpServer) => {
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : ENV.NODE_ENV === 'development'
    ? ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:19006', 'http://localhost:8081']
    : [];

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS: Origin ${origin} is not allowed`));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  logger.info('[Socket.IO] Initialized with default in-memory adapter');

  // JWT Handshake Authentication Middleware
  io.use(async (socket, next) => {
    try {
      let rawToken = socket.handshake.auth?.token || socket.handshake.headers?.authorization;

      if (!rawToken) {
        return next(new Error('Authentication failed: Token is missing'));
      }

      if (rawToken.startsWith('Bearer ')) {
        rawToken = rawToken.slice(7).trim();
      }

      // Verify JWT signature and expiration
      let decoded;
      try {
        decoded = verifyToken(rawToken);
      } catch (jwtErr) {
        if (jwtErr.name === 'TokenExpiredError') {
          return next(new Error('Authentication failed: Token has expired'));
        }
        return next(new Error('Authentication failed: Invalid token'));
      }

      if (!decoded || !decoded.id) {
        return next(new Error('Authentication failed: Invalid payload'));
      }

      // Direct Prisma database lookup for authenticated user
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          avatarUrl: true,
          isVerified: true,
        },
      });

      if (!user) {
        return next(new Error('Authentication failed: User no longer exists'));
      }

      // Attach authenticated user identity to socket instance
      socket.user = user;
      next();
    } catch (err) {
      logger.warn({ err: err.message }, '[Socket.IO Auth] Handshake authentication rejected');
      return next(new Error('Authentication failed'));
    }
  });

  // Connection Lifecycle Management
  io.on('connection', (socket) => {
    // Automatically join the user's secure personal room: user:{userId}
    const personalRoom = `user:${socket.user.id}`;
    socket.join(personalRoom);

    logger.info({
      socketId: socket.id,
      userId: socket.user.id,
      role: socket.user.role,
      room: personalRoom,
    }, `[Socket.IO Connected] User ${socket.user.id} joined personal room ${personalRoom}`);

    // Notify client of successful connection handshake
    socket.emit('connection:ready', {
      success: true,
      userId: socket.user.id,
      role: socket.user.role,
    });

    // Register real-time communication events
    registerRealtimeEvents(io, socket);

    socket.on('disconnect', (reason) => {
      logger.info({
        socketId: socket.id,
        userId: socket.user.id,
        reason,
      }, `[Socket.IO Disconnected] User ${socket.user.id} left`);
    });
  });

  ioInstance = io;
  return io;
};

/**
 * Get active Socket.IO Server instance
 */
export const getIO = () => {
  if (!ioInstance) {
    throw new Error('[Socket.IO] Server instance has not been initialized');
  }
  return ioInstance;
};

/**
 * Cleanly close Socket.IO server during shutdown
 */
export const closeSocket = async () => {
  if (ioInstance) {
    ioInstance.close();
    ioInstance = null;
  }
};

export default { initSocket, getIO, closeSocket };
