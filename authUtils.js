const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Generate OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Hash Password
async function hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
}

// Compare Password
async function comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
}

// Generate JWT Token
function generateToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// Verify JWT Token
function verifyToken(token) {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        return null;
    }
}

// Middleware to verify token
function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.userId = decoded.userId;
    next();
}

module.exports = {
    generateOTP,
    hashPassword,
    comparePassword,
    generateToken,
    verifyToken,
    authMiddleware
};