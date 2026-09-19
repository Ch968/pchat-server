import React, { useState, useContext } from 'react';
import { messagesAPI } from '../services/api';
import { AuthContext } from '../utils/AuthContext';
import './CreateGroupModal.css';

export default function CreateGroupModal({ onClose, onGroupCreated }) {
    const { user } = useContext(AuthContext);
    const [groupName, setGroupName] = useState('');
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

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
            console.error('Search failed', err);
        }
    };

    const toggleMember = (user) => {
        if (selectedMembers.find(m => m.id === user.id)) {
            setSelectedMembers(selectedMembers.filter(m => m.id !== user.id));
        } else {
            setSelectedMembers([...selectedMembers, user]);
        }
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        
        if (!groupName.trim()) {
            setError('Group name required');
            return;
        }

        if (selectedMembers.length === 0) {
            setError('Add at least 1 member');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const memberIds = selectedMembers.map(m => m.id);
            const response = await messagesAPI.createGroup(
                groupName,
                memberIds,
                null, // group_photo_url (can add later)
                '' // description
            );

            onGroupCreated(response.data.conversation);
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create group');
        }

        setLoading(false);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Create Group</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleCreateGroup}>
                    <input
                        type="text"
                        placeholder="Group name"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        required
                        autoFocus
                    />

                    <input
                        type="text"
                        placeholder="Search members..."
                        value={searchQuery}
                        onChange={(e) => searchUsers(e.target.value)}
                    />

                    <div className="members-section">
                        <h3>Add Members ({selectedMembers.length})</h3>
                        
                        {selectedMembers.length > 0 && (
                            <div className="selected-members">
                                {selectedMembers.map(member => (
                                    <div key={member.id} className="member-tag">
                                        {member.username}
                                        <button 
                                            type="button"
                                            onClick={() => toggleMember(member)}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="search-results-modal">
                            {searchResults.map(searchUser => (
                                <div
                                    key={searchUser.id}
                                    className={`user-result-modal ${selectedMembers.find(m => m.id === searchUser.id) ? 'selected' : ''}`}
                                    onClick={() => toggleMember(searchUser)}
                                >
                                    <input
                                        type="checkbox"
                                        checked={!!selectedMembers.find(m => m.id === searchUser.id)}
                                        onChange={() => {}}
                                    />
                                    <div className="user-info">
                                        <div className="user-name">{searchUser.username}</div>
                                        <div className="user-bio">{searchUser.bio || 'No bio'}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="modal-actions">
                        <button type="button" onClick={onClose} className="cancel-btn">
                            Cancel
                        </button>
                        <button type="submit" disabled={loading} className="create-btn">
                            {loading ? 'Creating...' : 'Create Group'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}