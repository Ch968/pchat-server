// client/src/pages/UserProfilePage.js - COMPLETE WORKING VERSION
import React, { useState, useEffect, useContext } from 'react';
import { authAPI } from '../services/api';
import { AuthContext } from '../utils/AuthContext';
import './UserProfilePage.css';

export default function UserProfilePage({ userId, onClose }) {
    const { user } = useContext(AuthContext);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isBlocked, setIsBlocked] = useState(false);
    const [isBlocking, setIsBlocking] = useState(false);

    useEffect(() => {
        const loadProfile = async () => {
            try {
                setLoading(true);
                setError('');
                console.log('Fetching profile for userId:', userId);
                const response = await authAPI.getUserProfile(userId);
                console.log('Profile response:', response.data);
                setProfile(response.data.user);
                setIsBlocked(response.data.user.isBlocked);
            } catch (err) {
                console.error('Profile error:', err);
                setError(err.response?.data?.error || 'Failed to load profile');
            } finally {
                setLoading(false);
            }
        };

        if (userId) {
            loadProfile();
        }
    }, [userId]);

    const handleBlockUser = async () => {
        try {
            setIsBlocking(true);
            await authAPI.blockUser(userId);
            setIsBlocked(true);
            setError('');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to block user');
        } finally {
            setIsBlocking(false);
        }
    };

    const handleUnblockUser = async () => {
        try {
            setIsBlocking(true);
            await authAPI.unblockUser(userId);
            setIsBlocked(false);
            setError('');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to unblock user');
        } finally {
            setIsBlocking(false);
        }
    };

    const getTimeDifference = (timestamp) => {
        if (!timestamp) return 'recently';
        
        const now = new Date();
        const then = new Date(timestamp);
        const diffMs = now - then;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };

    if (loading) {
        return (
            <div className="profile-modal-overlay">
                <div className="profile-modal">
                    <div className="profile-loading">Loading profile...</div>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="profile-modal-overlay">
                <div className="profile-modal">
                    <button className="close-profile-btn" onClick={onClose}>✕</button>
                    <div className="profile-error">{error || 'User not found'}</div>
                    <div style={{ padding: '20px', textAlign: 'center' }}>
                        <button className="close-profile-btn" onClick={onClose}>Close</button>
                    </div>
                </div>
            </div>
        );
    }

    const isOwnProfile = user?.id === parseInt(userId);

    return (
        <div className="profile-modal-overlay" onClick={onClose}>
            <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close-profile-btn" onClick={onClose}>✕</button>

                <div className="profile-header">
                    {profile.profile_photo_url ? (
                        <img src={profile.profile_photo_url} alt={profile.username} className="profile-avatar" />
                    ) : (
                        <div className="profile-avatar-placeholder">👤</div>
                    )}
                </div>

                <div className="profile-content">
                    <h2 className="profile-username">{profile.username}</h2>
                    <div className="profile-status">
                        <span className={`status-indicator ${profile.is_online ? 'online' : 'offline'}`}></span>
                        <span className="status-text">
                            {profile.is_online ? 'Online' : `Last seen ${getTimeDifference(profile.last_seen)}`}
                        </span>
                    </div>

                    <div className="profile-section">
                        <div className="section-title">Contact Info</div>
                        {profile.email && (
                            <div className="info-item">
                                <span className="info-label">📧 Email</span>
                                <span className="info-value">{profile.email}</span>
                            </div>
                        )}
                        {profile.phone && (
                            <div className="info-item">
                                <span className="info-label">📱 Phone</span>
                                <span className="info-value">{profile.phone}</span>
                            </div>
                        )}
                    </div>

                    {profile.bio && (
                        <div className="profile-section">
                            <div className="section-title">Bio</div>
                            <p className="profile-bio">{profile.bio}</p>
                        </div>
                    )}

                    <div className="profile-section">
                        <div className="section-title">Status</div>
                        <div className="info-item">
                            <span className="info-label">Last Seen</span>
                            <span className="info-value">{getTimeDifference(profile.last_seen)}</span>
                        </div>
                    </div>

                    {error && <div className="profile-error-message">{error}</div>}

                    {!isOwnProfile && (
                        <div className="profile-actions">
                            {isBlocked ? (
                                <button 
                                    className="unblock-btn"
                                    onClick={handleUnblockUser}
                                    disabled={isBlocking}
                                >
                                    {isBlocking ? 'Unblocking...' : '🔓 Unblock'}
                                </button>
                            ) : (
                                <button 
                                    className="block-btn"
                                    onClick={handleBlockUser}
                                    disabled={isBlocking}
                                >
                                    {isBlocking ? 'Blocking...' : '🚫 Block'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}