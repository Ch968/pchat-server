import React, { useState, useContext } from 'react';
import { authAPI } from '../services/api';
import { AuthContext } from '../utils/AuthContext';
import './AuthPage.css';

export default function LoginPage() {
    const { login } = useContext(AuthContext);
    const [mode, setMode] = useState('register'); // 'register' or 'login'
    const [step, setStep] = useState('phone'); // phone, otp, password
    const [phoneOrEmail, setPhoneOrEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // ===== REGISTER FLOW =====
    const handleSendOTP = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await authAPI.sendOTP(phoneOrEmail);
            setStep('otp');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to send OTP');
        }

        setLoading(false);
    };

    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await authAPI.verifyOTP(phoneOrEmail, otp, username || 'User', password);
            if (response.data.success) {
                login(response.data.user, response.data.token);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to verify OTP');
        }

        setLoading(false);
    };

    // ===== LOGIN FLOW =====
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await authAPI.login(phoneOrEmail, password);
            if (response.data.success) {
                login(response.data.user, response.data.token);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Invalid email/phone or password');
        }

        setLoading(false);
    };

    return (
        <div className="auth-container">
            <div className="auth-box">
                <h1>💬 PChat</h1>
                <p>Connect with everyone, everywhere</p>

                {error && <div className="error-message">{error}</div>}

                {/* ===== REGISTER MODE ===== */}
                {mode === 'register' ? (
                    <>
                        {step === 'phone' && (
                            <form onSubmit={handleSendOTP}>
                                <h2>Create Account</h2>
                                <input
                                    type="text"
                                    placeholder="Phone or Email"
                                    value={phoneOrEmail}
                                    onChange={(e) => setPhoneOrEmail(e.target.value)}
                                    required
                                    autoFocus
                                />
                                <button type="submit" disabled={loading}>
                                    {loading ? 'Sending...' : 'Send OTP'}
                                </button>
                            </form>
                        )}

                        {step === 'otp' && (
                            <form onSubmit={handleVerifyOTP}>
                                <h2>Verify OTP</h2>
                                <p>Enter OTP sent to {phoneOrEmail}</p>
                                <input
                                    type="text"
                                    placeholder="6-digit OTP"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.slice(0, 6))}
                                    maxLength="6"
                                    required
                                    autoFocus
                                />
                                <input
                                    type="text"
                                    placeholder="Username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                />
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button type="submit" disabled={loading}>
                                    {loading ? 'Verifying...' : 'Verify & Create Account'}
                                </button>
                                <button type="button" onClick={() => setStep('phone')} className="back-btn">
                                    Back
                                </button>
                            </form>
                        )}

                        <p className="switch-text">
                            Already have an account?{' '}
                            <a href="#" onClick={(e) => {
                                e.preventDefault();
                                setMode('login');
                                setStep('phone');
                                setError('');
                            }}>
                                Login
                            </a>
                        </p>
                    </>
                ) : (
                    // ===== LOGIN MODE =====
                    <>
                        <form onSubmit={handleLogin}>
                            <h2>Login</h2>
                            <input
                                type="text"
                                placeholder="Email or Phone"
                                value={phoneOrEmail}
                                onChange={(e) => setPhoneOrEmail(e.target.value)}
                                required
                                autoFocus
                            />
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button type="submit" disabled={loading}>
                                {loading ? 'Logging in...' : 'Login'}
                            </button>
                        </form>

                        <p className="switch-text">
                            Don't have an account?{' '}
                            <a href="#" onClick={(e) => {
                                e.preventDefault();
                                setMode('register');
                                setStep('phone');
                                setPhoneOrEmail('');
                                setPassword('');
                                setUsername('');
                                setOtp('');
                                setError('');
                            }}>
                                Sign Up
                            </a>
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}