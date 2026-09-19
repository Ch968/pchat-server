import React from 'react';
import { AuthProvider, AuthContext } from './utils/AuthContext';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import './App.css';

function AppContent() {
    const { user, loading } = React.useContext(AuthContext);

    if (loading) {
        return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '18px' }}>Loading...</div>;
    }

    return user ? <ChatPage /> : <LoginPage />;
}

function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}

export default App;