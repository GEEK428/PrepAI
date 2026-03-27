import React from 'react';
import NotificationBell from './NotificationBell';
import { useAuth } from '../../auth/hooks/useAuth';
import { useLocation } from 'react-router';

/* Map route → page title */
const PAGE_TITLES = {
    '/dashboard':        'Dashboard',
    '/':                 'Resume Analysis',
    '/resume-builder':   'Resume Builder',
    '/notes':            'Notes & Prep Space',
    '/progress-tracker': 'Progress Tracker',
    '/settings':         'Settings',
};

const TopBar = ({ onMenuOpen }) => {
    const { user } = useAuth();
    const location = useLocation();

    /* Find the best matching title */
    const pageTitle = Object.entries(PAGE_TITLES).find(([path]) =>
        path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(path)
    )?.[1] ?? 'IntelliPrep';

    return (
        <header className="app-top-bar">
            {/* Left: hamburger (mobile) + page title */}
            <div className="top-bar-left">
                {onMenuOpen && (
                    <button
                        className="hamburger-btn top-bar-hamburger"
                        onClick={onMenuOpen}
                        aria-label="Open menu"
                    >
                        <span className="material-symbols-outlined">menu</span>
                    </button>
                )}
                <h2 className="top-bar-title">{pageTitle}</h2>
            </div>

            {/* Right: notification + user */}
            <div className="top-bar-right">
                <NotificationBell />
                <div className="user-profile-badge">
                    <img
                        className="user-avatar"
                        src="/default-avatar.png"
                        alt="User"
                        onError={(e) => {
                            e.target.style.display = 'none';
                            if (!e.target.parentElement.querySelector('.avatar-fallback')) {
                                const fb = document.createElement('div');
                                fb.className = 'avatar-fallback';
                                fb.innerHTML = '<span class="material-symbols-outlined">person</span>';
                                e.target.parentElement.appendChild(fb);
                            }
                        }}
                    />
                    {(user?.fullName || user?.username) && (
                        <span className="user-name">{user?.fullName || user?.username}</span>
                    )}
                </div>
            </div>
        </header>
    );
};

export default TopBar;
