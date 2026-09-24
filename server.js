// server/server.js - COMPLETE CORRECTED FILE
require('./init-db');
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const messagesRoutes = require('./routes/messages');
const pool = require('./database');

const app = express();

// ONLY ONE CORS CONFIG - KEEP THIS:
app.use(cors({
  origin: ['https://pchat-seven.vercel.app', 'http://localhost:3001'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ... rest of middleware

const server = http.createServer(app);

// UPDATE SOCKET.IO CORS:
const io = socketIO(server, {
  cors: {
    origin: ['https://pchat-seven.vercel.app', 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});
// Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messagesRoutes);

// Test route
app.get('/api/test', (req, res) => {
    res.json({ message: '✅ PChat Server is running!' });
});

// Store active users
const activeUsers = new Map(); // userId -> socketId

// Socket.IO Real-time Events
io.on('connection', (socket) => {
    console.log('📱 New user connected:', socket.id);

    // ===== USER COMES ONLINE (ONLY ONE HANDLER) =====
    socket.on('user_online', async (userId) => {
        activeUsers.set(userId, socket.id);
        socket.join(`user_${userId}`);

        // Update user status in database
        await pool.query('UPDATE users SET is_online = true, last_seen = CURRENT_TIMESTAMP WHERE id = $1', [userId]);

        // Notify others (ONLINE STATUS FEATURE)
        io.emit('user_status', { 
            userId, 
            is_online: true,
            last_seen: null
        });

    socket.emit('user_status', {
        userId,
        is_online: true,
        last_seen: null
    });

    console.log('✅ User ${userId} is online');
    });

    // ===== SEND MESSAGE =====
    socket.on('send_message', async (data) => {
        const { conversationId, senderId, username, content, messageType = 'text' } = data;

        // Broadcast to all in conversation
        io.emit('new_message', {
            id: Date.now(),
            conversationId,
            sender_id: senderId,
            username: username,
            content,
            messageType,
            created_at: new Date().toISOString(),
            is_read: false
        });

        console.log(`✅ Message broadcasted tonconversation ${conversationId}`);
    });

    // ===== TYPING INDICATOR =====
    socket.on('typing', (data) => {
        const { conversationId, userId, username } = data;
        socket.broadcast.emit('user_typing', {
            conversationId,
            userId,
            username
        });
    });

    // ===== STOP TYPING =====
    socket.on('stop_typing', (data) => {
        const { conversationId, userId } = data;
        socket.broadcast.emit('user_stopped_typing', {
            conversationId,
            userId
        });
    });

    // ===== USER GOES OFFLINE =====
    socket.on('disconnect', async () => {
        for (let [userId, socketId] of activeUsers.entries()) {
            if (socketId === socket.id) {
                activeUsers.delete(userId);

                // Update database
                await pool.query('UPDATE users SET is_online = false, last_seen = CURRENT_TIMESTAMP WHERE id = $1', [userId]);

                // Notify others (ONLINE STATUS FEATURE)
                io.emit('user_status', { 
                    userId, 
                    is_online: false,
                    last_seen: new Date()
                });
                console.log(`❌ User ${userId} is offline`);
                break;
            }
        }
    });

    // ===== READ RECEIPT =====
    socket.on('message_read', (data) => {
        const { messageId, userId } = data;
        io.emit('message_read_receipt', { messageId, userId });
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n🚀 PChat Server running on http://localhost:${PORT}`);
    console.log(`📡 WebSocket ready for real-time messaging\n`);
});

module.exports = { app, server, io };