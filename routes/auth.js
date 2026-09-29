const express = require('express');
const router = express.Router();
const pool = require('../database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// REGISTER - Simple username + password
router.post('/register', async (req, res) => {
    try {
        const { username, password, email } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        // Check if user exists
        const existingUser = await pool.query(
            'SELECT * FROM users WHERE username = $1 OR email = $1',
            [username]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const newUserResult = await pool.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
            [username, email || null, hashedPassword]
        );

        const newUser = newUserResult.rows[0];
        const token = jwt.sign({ userId: newUser.id }, process.env.JWT_SECRET || 'secret_key', { expiresIn: '30d' });

        console.log(`✅ User registered: ${username}`);

        res.json({
            success: true,
            message: 'Account created successfully',
            user: newUser,
            token
        });

    } catch (error) {
        console.error('Register Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// LOGIN - Simple username + password
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        // Find user
        const userResult = await pool.query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );

        if (userResult.rows.length === 0) {
            return res.status(400).json({ error: 'Username not found' });
        }

        const user = userResult.rows[0];

        // Check password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            return res.status(400).json({ error: 'Invalid password' });
        }

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret_key', { expiresIn: '30d' });

        console.log(`✅ User logged in: ${username}`);

        res.json({
            success: true,
            user: { id: user.id, username: user.username, email: user.email },
            token
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;