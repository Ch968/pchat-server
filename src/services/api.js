// client/src/services/api.js - CLEAN VERSION
import axios from 'axios';

const API = axios.create({
    baseURL: 'http://localhost:3000/api'
});

// Add token to every request
API.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ==========================================
// AUTHENTICATION FUNCTIONS
// ==========================================

export const authAPI = {
    sendOTP: (phone_or_email) =>
        API.post('/auth/send-otp', { phone_or_email }),
    
    verifyOTP: (phone_or_email, otp_code, username, password) =>
        API.post('/auth/verify-otp', { phone_or_email, otp_code, username, password }),
    
    login: (email_or_phone, password) =>
        API.post('/auth/login', { email_or_phone, password }),
    
    getProfile: (userId) =>
        API.get(`/auth/profile/${userId}`),
    
    updateProfile: (data) =>
        API.put('/auth/profile', data),

    blockUser: (userId) =>
        API.post(`/auth/block/${userId}`),
    
    unblockUser: (userId) =>
        API.post(`/auth/unblock/${userId}`),
    
    getBlockedUsers: () =>
        API.get('/auth/blocked-users'),

    getUserProfile: (userId) =>
        API.get(`/auth/profile/${userId}`)
};

// ==========================================
// MESSAGING FUNCTIONS
// ==========================================

export const messagesAPI = {
    getConversations: () =>
        API.get('/messages/conversations'),
    
    getMessages: (conversationId, limit = 50, offset = 0) =>
        API.get(`/messages/conversations/${conversationId}/messages`, { 
            params: { limit, offset } 
        }),
    
    createDirectMessage: (user_id) =>
        API.post('/messages/conversations/create-direct', { user_id }),
    
    createGroup: (name, member_ids, group_photo_url, description) =>
        API.post('/messages/conversations/create-group', { 
            name, 
            member_ids, 
            group_photo_url, 
            description 
        }),
    
    sendMessage: (conversation_id, content, message_type = 'text', media_url = null) =>
        API.post('/messages/send', { 
            conversation_id, 
            content, 
            message_type, 
            media_url 
        }),
    
    markAsRead: (messageId) =>
        API.put(`/messages/${messageId}/read`),
    
    markConversationAsRead: (conversationId) =>
        API.put(`/messages/conversations/${conversationId}/mark-read`),
    
    searchUsers: (query) =>
        API.get('/messages/search/users', { params: { query } }),

        // Reactions
    addReaction: (messageId, emoji) =>
        API.post(`/messages/${messageId}/react`, { emoji }),
    
    getReactions: (messageId) =>
        API.get(`/messages/${messageId}/reactions`),
};

export default API;