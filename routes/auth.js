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
router.post('/send-otp', async (req, res) => {
    try {
        const { phone_or_email } = req.body;

        if (!phone_or_email) {
            return res.status(400).json({ error: 'Email required' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Send via Mailgun
        const mailgun = require('mailgun.js');
        const FormData = require('form-data');
        const mg = new mailgun(FormData);

        const client = mg.client({
            username: 'api',
            key: process.env.MAILGUN_API_KEY
        });

        await client.messages.create(process.env.MAILGUN_DOMAIN, {
            from: `noreply@${process.env.MAILGUN_DOMAIN}`,
            to: phone_or_email,
            subject: 'Your PChat OTP',
            html: `<h2>Your PChat OTP: <strong>${otp}</strong></h2><p>Valid for 10 minutes</p>`
        });

        console.log(`✅ OTP sent to: ${phone_or_email}`);

        res.json({ 
            success: true, 
            message: 'OTP sent to your email'
        });
    } catch (error) {
        console.error('Send OTP Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== VERIFY OTP & CREATE/LOGIN =====
router.post('/verify-otp', async (req, res) => {
    try {
        const { phone_or_email, otp_code, username, password } = req.body;

        // Check if OTP is correct
        const otpResult = await pool.query(
            `SELECT * FROM otp_verifications 
             WHERE otp_code = $1 AND expires_at > CURRENT_TIMESTAMP 
             ORDER BY created_at DESC LIMIT 1`,
            [otp_code]
        );

        if (otpResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        // Check if user exists
        const userResult = await pool.query(
            'SELECT * FROM users WHERE email = $1 OR phone = $1',
            [phone_or_email]
        );

        if (userResult.rows.length > 0) {
            // User exists - LOGIN
            const user = userResult.rows[0];
            const passwordMatch = await bcrypt.compare(password, user.password_hash);
            
            if (!passwordMatch) {
                return res.status(400).json({ error: 'Invalid password' });
            }

            const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret_key', { expiresIn: '30d' });

            return res.json({
                success: true,
                user: { id: user.id, username: user.username, email: user.email, phone: user.phone },
                token
            });
        } else {
            // User doesn't exist - CREATE
            const hashedPassword = await bcrypt.hash(password, 10);

            const isEmail = phone_or_email.includes('@');
            const email = isEmail ? phone_or_email : null;
            const phone = isEmail ? null : phone_or_email;

            const newUserResult = await pool.query(
                'INSERT INTO users (username, email, phone, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, username, email, phone',
                [username, email, phone, hashedPassword]
            );

            const newUser = newUserResult.rows[0];
            const token = jwt.sign({ userId: newUser.id }, process.env.JWT_SECRET || 'secret_key', { expiresIn: '30d' });

            return res.json({
                success: true,
                user: newUser,
                token
            });
        }
    } catch (error) {
        console.error('Verify OTP Error:', error);
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