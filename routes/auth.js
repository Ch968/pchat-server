// server/routes/auth.js - CLEAN WORKING VERSION
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../database');
const { authMiddleware } = require('../authUtils');
const nodemailer = require('nodemailer');

// Configure email
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASSWORD
    }
});

// ===== GET USER PROFILE =====
router.get('/profile/:userId', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.userId;

        const userResult = await pool.query(
            'SELECT id, username, email, phone, bio, profile_photo_url, is_online, last_seen FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];

        const blockedResult = await pool.query(
            'SELECT id FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2',
            [currentUserId, userId]
        );

        const isBlocked = blockedResult.rows.length > 0;

        res.json({
            success: true,
            user: {
                ...user,
                isBlocked
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// ===== BLOCK USER =====
router.post('/block/:userId', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.userId;

        if (currentUserId === parseInt(userId)) {
            return res.status(400).json({ error: 'Cannot block yourself' });
        }

        const existingBlock = await pool.query(
            'SELECT id FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2',
            [currentUserId, userId]
        );

        if (existingBlock.rows.length > 0) {
            return res.status(400).json({ error: 'User already blocked' });
        }

        await pool.query(
            'INSERT INTO blocked_users (blocker_id, blocked_id) VALUES ($1, $2)',
            [currentUserId, userId]
        );

        res.json({ success: true, message: 'User blocked' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// ===== UNBLOCK USER =====
router.post('/unblock/:userId', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.userId;

        const result = await pool.query(
            'DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2 RETURNING id',
            [currentUserId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'User not blocked' });
        }

        res.json({ success: true, message: 'User unblocked' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// ===== SEND OTP =====
router.post('/send-verification', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email required' });
        }

        // Generate random token
        const crypto = require('crypto');
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Store token in database
        await pool.query(
            `INSERT INTO verification_tokens (email, token, expires_at) 
             VALUES ($1, $2, $3)
             ON CONFLICT (email) DO UPDATE SET token = $2, expires_at = $3`,
            [email, token, expiresAt]
        );

        // Create verification link
        const verificationLink = `https://pchat-seven.vercel.app/verify?token=${token}`;

        console.log(`✅ Verification link: ${verificationLink}`);

        // For testing: just return the link (no email sending needed!)
        res.json({ 
            success: true, 
            message: 'Verification link created',
            testLink: verificationLink // Remove this in production!
        });

    } catch (error) {
        console.error('Send Verification Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== VERIFY OTP & CREATE/LOGIN =====
router.post('/verify-email', async (req, res) => {
    try {
        const { token, username, password } = req.body;

        // Check if token exists and is valid
        const tokenResult = await pool.query(
            `SELECT * FROM verification_tokens 
             WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP AND verified = false`,
            [token]
        );

        if (tokenResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired verification link' });
        }

        const { email } = tokenResult.rows[0];

        // Mark as verified
        await pool.query(
            `UPDATE verification_tokens SET verified = true WHERE token = $1`,
            [token]
        );

        // Check if user exists
        const userResult = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (userResult.rows.length > 0) {
            // User exists - LOGIN
            const user = userResult.rows[0];
            const bcrypt = require('bcryptjs');
            const passwordMatch = await bcrypt.compare(password, user.password_hash);
            
            if (!passwordMatch) {
                return res.status(400).json({ error: 'Invalid password' });
            }

            const jwt = require('jsonwebtoken');
            const token_jwt = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret_key', { expiresIn: '30d' });

            return res.json({
                success: true,
                user: { id: user.id, username: user.username, email: user.email },
                token: token_jwt
            });
        } else {
            // User doesn't exist - CREATE
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash(password, 10);

            const newUserResult = await pool.query(
                'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
                [username, email, hashedPassword]
            );

            const newUser = newUserResult.rows[0];
            const jwt = require('jsonwebtoken');
            const token_jwt = jwt.sign({ userId: newUser.id }, process.env.JWT_SECRET || 'secret_key', { expiresIn: '30d' });

            return res.json({
                success: true,
                user: newUser,
                token: token_jwt
            });
        }

    } catch (error) {
        console.error('Verify Email Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== LOGIN =====
router.post('/login', async (req, res) => {
    try {
        const { email_or_phone, password } = req.body;

        if (!email_or_phone || !password) {
            return res.status(400).json({ error: 'Email/phone and password required' });
        }

        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1 OR phone = $1',
            [email_or_phone]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            return res.status(400).json({ error: 'Invalid password' });
        }

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret_key', { expiresIn: '30d' });

        res.json({
            success: true,
            user: { id: user.id, username: user.username, email: user.email, phone: user.phone },
            token
        });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;