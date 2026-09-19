// client/src/pages/ChatPage.js - COMPLETE WITH PROFILE FEATURE
import AdBanner from '../components/AdBanner';
import React, { useState, useContext, useEffect } from 'react';
import { messagesAPI } from '../services/api';
import { AuthContext } from '../utils/AuthContext';
import CreateGroupModal from '../components/CreateGroupModal';
import UserProfilePage from './UserProfilePage';
import io from 'socket.io-client';
import './ChatPage.css';

const socket = io('http://localhost:3000');

export default function ChatPage() {
    const { user, logout } = useContext(AuthContext);
    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [typingUser, setTypingUser] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showSearch, setShowSearch] = useState(false);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [otherUserStatus, setOtherUserStatus] = useState({ isOnline: false, lastSeen: null });
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [selectedProfileUserId, setSelectedProfileUserId] = useState(null);

    useEffect(() => {
        if (user) {
            socket.emit('Emitting user_online for:', user.id);
            socket.emit('user_online', user.id);
            loadConversations();
        }

        socket.on('new_message', (message) => {
            console.log('Received new_message:', message);
            if (selectedConversation && message.conversationId === selectedConversation.id) {
                setMessages(prev => [...prev, message]);
            }
        });

        socket.on('user_typing', (data) => {
            if (selectedConversation && data.conversationId === selectedConversation.id) {
                setTypingUser(data.username);
            }
        });

        socket.on('user_stopped_typing', () => {
            setTypingUser(null);
        });

        socket.on('user_status', (data) => {
            console.log('Received user_status:', data);
            if (selectedConversation && !selectedConversation.is_group) {
                setOtherUserStatus({ 
                    isOnline: data.is_online, 
                    lastSeen: data.last_seen 
                });
            }
        });

        return () => socket.disconnect();
    }, [user, selectedConversation]);

    const loadConversations = async () => {
        try {
            const response = await messagesAPI.getConversations();
            setConversations(response.data.conversations || []);
            setLoading(false);
        } catch (err) {
            console.error('Failed to load conversations', err);
            setLoading(false);
        }
    };

    const openConversation = async (conversation) => {
        setSelectedConversation(conversation);
        setShowSearch(false);
        try {
            const response = await messagesAPI.getMessages(conversation.id);
            setMessages(response.data.messages || []);
            
            await messagesAPI.markConversationAsRead(conversation.id);
            
            setMessages(prev => prev.map(msg => ({
                ...msg,
                is_read: msg.sender_id === user.id ? msg.is_read : true
            })));
        } catch (err) {
            console.error('Failed to load messages', err);
        }
    };

    const searchUsers = async (query) => {
        setSearchQuery(query);
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        try {
            const response = await messagesAPI.searchUsers(query);
            setSearchResults(response.data.users || []);
        } catch (err) {
            console.error('Failed to search users', err);
        }
    };

    const startDirectMessage = async (userId) => {
        try {
            const response = await messagesAPI.createDirectMessage(userId);
            const newConversation = response.data.conversation;
            
            setConversations(prev => {
                const exists = prev.some(c => c.id === newConversation.id);
                return exists ? prev : [newConversation, ...prev];
            });

            openConversation(newConversation);
            setShowSearch(false);
            setSearchQuery('');
            setSearchResults([]);
        } catch (err) {
            console.error('Failed to create direct message', err);
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedConversation) return;

        const messageContent = newMessage;
        setNewMessage('');

        try {
            const response = await messagesAPI.sendMessage(selectedConversation.id, messageContent);
            
            const newMsg = {
                id: response.data.message.id || Date.now(),
                content: messageContent,
                sender_id: user.id,
                username: user.username,
                created_at: new Date().toISOString(),
                is_read: false
            };
            setMessages(prev => [...prev, newMsg]);
            
            socket.emit('send_message', {
                conversationId: selectedConversation.id,
                senderId: user.id,
                username: user.username,
                content: messageContent,
                messageType: 'text',
                created_at: new Date().toISOString()
            });
        } catch (err) {
            console.error('Failed to send message', err);
            setNewMessage(messageContent);
        }
    };

    const handleTyping = () => {
        socket.emit('typing', {
            conversationId: selectedConversation.id,
            userId: user.id,
            username: user.username
        });

        setTimeout(() => {
            socket.emit('stop_typing', {
                conversationId: selectedConversation.id,
                userId: user.id
            });
        }, 1000);
    };

         const handleAddReaction = async (messageId, emoji) => {
         try {
        await messagesAPI.addReaction(messageId, emoji);
        // Emit via Socket for real-time
        socket.emit('message_reaction', {
            messageId,
            emoji,
            userId: user.id
         });
     }   catch (err) {
        console.error('Failed to add reaction', err);
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

    const openUserProfile = (userId) => {
        console.log('Opening profile for user:', userId);
        setSelectedProfileUserId(userId);
        setShowProfileModal(true);
    };
    const handleUpgradePremium = () => {
    const isPremium = window.confirm('Upgrade to Premium ($2.99/month)?\n\nFull features:\n✅ Remove Ads\n✅ Video Calls\n✅ Unlimited Storage');
    
    if (isPremium) {
        localStorage.setItem('isPremium', 'true');
        localStorage.setItem('premiumExpiry', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
        
        const updatedUser = { ...user, isPremium: true };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        window.alert('✅ Welcome to Premium! Ads removed.');
        window.location.reload();
    }
};

    if (loading) return <div className="loading">Loading chats...</div>;

    return (
        <div className="chat-page">
            <div className="sidebar">
                <div className="sidebar-header">
                    <h2>💬 Chats</h2>
                     {!user?.isPremium && (
        <button 
            className="premium-btn"
            onClick={() => handleUpgradePremium()}
            style={{
                backgroundColor: '#ffd700',
                color: '#000',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '12px',
                marginBottom: '10px'
            }}
        >
            ⭐ Remove Ads - $2.99/mo
        </button>
    )}
                    <div className="new-chat-menu">
                        <button className="new-chat-btn" onClick={() => setShowSearch(!showSearch)}>
                            ➕ Direct
                        </button>
                        <button className="new-chat-btn" onClick={() => setShowGroupModal(true)}>
                            👥 Group
                        </button>
                    </div>
                </div>

                {showSearch && (
                    <div className="search-section">
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchQuery}
                            onChange={(e) => searchUsers(e.target.value)}
                            className="search-input"
                            autoFocus
                        />
                        <div className="search-results">
                            {searchResults.length === 0 ? (
                                <p className="no-results">
                                    {searchQuery ? 'No users found' : 'Type to search...'}
                                </p>
                            ) : (
                                searchResults.map(foundUser => (
                                    <div
                                        key={foundUser.id}
                                        className="user-result"
                                        onClick={() => startDirectMessage(foundUser.id)}
                                    >
                                        <div className="user-name">👤 {foundUser.username}</div>
                                        <div className="user-bio">{foundUser.bio || 'No bio'}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                <div className="conversations-list">
                    {conversations.length === 0 ? (
                        <p className="no-chats">
                            {showSearch ? '' : 'No conversations yet\n\nClick "Direct" or "Group" to start'}
                        </p>
                    ) : (
                        conversations.map(conv => (
                            <div
                                key={conv.id}
                                className={`conversation-item ${selectedConversation?.id === conv.id ? 'active' : ''}`}
                                onClick={() => openConversation(conv)}
                            >
                                <div className="conv-name">
                                    {conv.is_group ? '👥' : '👤'} {conv.name || 'Direct Message'}
                                </div>
                                <div className="conv-preview">Click to open</div>
                            </div>
                        ))
                    )}
                </div>

                <div className="sidebar-footer">
                    <div className="username">👤 {user?.username}</div>
                    <button className="logout-btn" onClick={logout}>
                        🚪 Logout
                    </button>
                </div>
            </div>

            <div className="chat-area">
                {selectedConversation ? (
                    <>
                        <div className="chat-header">
                            <div>
                                <h3>{selectedConversation.name || 'Direct Message'}</h3>
                                {!selectedConversation.is_group && (
                                    <div className="user-status">
                                        <span className={`status-dot ${otherUserStatus.isOnline ? 'online' : 'offline'}`}></span>
                                        <span>
                                            {otherUserStatus.isOnline 
                                                ? 'Online' 
                                                : `Last seen ${getTimeDifference(otherUserStatus.lastSeen)}`}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                  <AdBanner />
                        <div className="messages-container">
                            {messages.length === 0 ? (
                                <div className="no-messages">👋 Start the conversation!</div>
                            ) : (
                                messages.map(msg => (
                                    <div key={msg.id} className={`message ${msg.sender_id === user.id ? 'sent' : 'received'}`}>
                                        <div className="message-content">
                                            <div 
                                                className="sender-info clickable-username"
                                                onClick={() => {
                                                    if (msg.sender_id !== user.id) {
                                                        openUserProfile(msg.sender_id);
                                                    }
                                                }}
                                            >
                                                {msg.sender_id === user.id ? 'You' : (msg.username || 'User')}
                                            </div>
                                            <div className="message-bubble">{msg.content}</div>
                                            <div className="message-reactions">
                                                {['😂', '😍', '😮', '🤔', '😢', '😡'].map(emoji => (
                                                    <button
                                                    key={emoji}
                                                    className="reaction-btn"
                                                    onClick={() => handleAddReaction(msg.id, emoji)}
                                                    title="React"
                                            >
                                                {emoji}
                                                </button>
                                                ))}
                                                </div>
                                            <div className="message-footer">
                                                <small className="message-time">
                                                    {new Date(msg.created_at).toLocaleTimeString([], { 
                                                        hour: '2-digit', 
                                                        minute: '2-digit' 
                                                    })}
                                                </small>
                                                {msg.sender_id === user.id && (
                                                    <span className="read-receipt">
                                                        {msg.is_read ? '✓✓' : '✓'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                            {typingUser && (
                                <div className="message received">
                                    <div className="message-content">
                                        <div className="typing-indicator">
                                            <span></span><span></span><span></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <form onSubmit={sendMessage} className="message-form">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => {
                                    setNewMessage(e.target.value);
                                    handleTyping();
                                }}
                                placeholder="Type a message..."
                                className="message-input"
                            />
                            <button type="submit" className="send-btn">
                                📤 Send
                            </button>
                         <AdBanner />
                         <form onSubmit={sendMessage} className="message-form"></form>
                        </form>
                    </>
                ) : (
                    <div className="no-conversation">
                        <p style={{ fontSize: '48px' }}>💬</p>
                        <p>Welcome to PChat!</p>
                        <p style={{ color: '#666', fontSize: '13px' }}>Click "Direct" or "Group" to start a conversation</p>
                    </div>
                )}
            </div>

            {showGroupModal && (
                <CreateGroupModal 
                    onClose={() => setShowGroupModal(false)}
                    onGroupCreated={(group) => {
                        setConversations(prev => [group, ...prev]);
                        openConversation(group);
                    }}
                />
            )}

            {showProfileModal && selectedProfileUserId && (
                <UserProfilePage 
                    userId={selectedProfileUserId}
                    onClose={() => {
                        setShowProfileModal(false);
                        setSelectedProfileUserId(null);
                    }}
                />
            )}
        </div>
    );
}