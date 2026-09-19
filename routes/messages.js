// server/routes/messages.js - COMPLETE WITH REACTIONS
const express = require('express');
const router = express.Router();
const pool = require('../database');
const { authMiddleware } = require('../authUtils');

// ===== GET CONVERSATIONS =====
router.get('/conversations', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;

        const result = await pool.query(
            `SELECT c.id, c.name, c.is_group, c.created_at, c.group_photo_url
             FROM conversations c
             JOIN conversation_members cm ON c.id = cm.conversation_id
             WHERE cm.user_id = $1
             ORDER BY c.created_at DESC`,
            [userId]
        );

        res.json({ success: true, conversations: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// ===== GET MESSAGES =====
router.get('/conversations/:conversationId/messages', authMiddleware, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const result = await pool.query(
            `SELECT m.id, m.content, m.sender_id, u.username, m.created_at, m.is_read
             FROM messages m
             JOIN users u ON m.sender_id = u.id
             WHERE m.conversation_id = $1
             ORDER BY m.created_at ASC
             LIMIT $2 OFFSET $3`,
            [conversationId, limit, offset]
        );

        res.json({ success: true, messages: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// ===== CREATE DIRECT MESSAGE =====
router.post('/conversations/create-direct', authMiddleware, async (req, res) => {
    try {
        const { user_id } = req.body;
        const currentUserId = req.userId;

        if (currentUserId === user_id) {
            return res.status(400).json({ error: 'Cannot message yourself' });
        }

        const existing = await pool.query(
            `SELECT c.id FROM conversations c
             JOIN conversation_members cm1 ON c.id = cm1.conversation_id
             JOIN conversation_members cm2 ON c.id = cm2.conversation_id
             WHERE c.is_group = false 
             AND cm1.user_id = $1 AND cm2.user_id = $2`,
            [currentUserId, user_id]
        );

        if (existing.rows.length > 0) {
            const conv = await pool.query('SELECT * FROM conversations WHERE id = $1', [existing.rows[0].id]);
            return res.json({ success: true, conversation: conv.rows[0] });
        }

        const result = await pool.query(
            'INSERT INTO conversations (is_group, name) VALUES (false, $1) RETURNING *',
            [`${currentUserId}_${user_id}`]
        );

        const convId = result.rows[0].id;

        await pool.query(
            'INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
            [convId, currentUserId, user_id]
        );

        res.json({ success: true, conversation: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// ===== CREATE GROUP =====
router.post('/conversations/create-group', authMiddleware, async (req, res) => {
    try {
        const { name, member_ids, group_photo_url, description } = req.body;
        const creatorId = req.userId;

        const result = await pool.query(
            'INSERT INTO conversations (name, is_group, group_photo_url, description) VALUES ($1, true, $2, $3) RETURNING *',
            [name, group_photo_url || null, description || null]
        );

        const conversationId = result.rows[0].id;

        const members = [creatorId, ...member_ids];
        for (const memberId of members) {
            await pool.query(
                'INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2)',
                [conversationId, memberId]
            );
        }

        res.json({ success: true, conversation: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// ===== SEND MESSAGE =====
router.post('/send', authMiddleware, async (req, res) => {
    try {
        const { conversation_id, content, message_type = 'text', media_url } = req.body;
        const senderId = req.userId;

        const result = await pool.query(
            `INSERT INTO messages (conversation_id, sender_id, content, message_type, media_url)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, sender_id, content, created_at, is_read`,
            [conversation_id, senderId, content, message_type, media_url]
        );

        res.json({ success: true, message: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// ===== MARK MESSAGE AS READ =====
router.put('/:messageId/read', authMiddleware, async (req, res) => {
    try {
        const { messageId } = req.params;

        await pool.query('UPDATE messages SET is_read = true WHERE id = $1', [messageId]);

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// ===== MARK CONVERSATION AS READ =====
router.put('/conversations/:conversationId/mark-read', authMiddleware, async (req, res) => {
    try {
        const { conversationId } = req.params;

        await pool.query(
            'UPDATE messages SET is_read = true WHERE conversation_id = $1',
            [conversationId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// ===== SEARCH USERS =====
router.get('/search/users', authMiddleware, async (req, res) => {
    try {
        const { query } = req.query;

        const result = await pool.query(
            'SELECT id, username, email, bio, profile_photo_url FROM users WHERE username ILIKE $1 LIMIT 10',
            [`%${query}%`]
        );

        res.json({ success: true, users: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// ===== ADD MESSAGE REACTION =====
router.post('/messages/:messageId/react', authMiddleware, async (req, res) => {
    try {
        const { messageId } = req.params;
        const { emoji } = req.body;
        const userId = req.userId;

        // Check if reaction already exists
        const existing = await pool.query(
            'SELECT id FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
            [messageId, userId, emoji]
        );

        if (existing.rows.length > 0) {
            // Remove reaction if exists
            await pool.query(
                'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
                [messageId, userId, emoji]
            );
            res.json({ success: true, action: 'removed' });
        } else {
            // Add reaction
            await pool.query(
                'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)',
                [messageId, userId, emoji]
            );
            res.json({ success: true, action: 'added' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// ===== GET MESSAGE REACTIONS =====
router.get('/messages/:messageId/reactions', authMiddleware, async (req, res) => {
    try {
        const { messageId } = req.params;

        const result = await pool.query(
            'SELECT emoji, COUNT(*) as count FROM message_reactions WHERE message_id = $1 GROUP BY emoji',
            [messageId]
        );

        res.json({ success: true, reactions: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;