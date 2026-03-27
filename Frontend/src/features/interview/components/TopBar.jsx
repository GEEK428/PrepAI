import React from 'react';
import NotificationBell from './NotificationBell';
import { useAuth } from '../../auth/hooks/useAuth';
import { useLocation, useNavigate } from 'react-router';

/* Map route → page title */
const PAGE_TITLES = {
    '/dashboard':        'Dashboard',
    '/':                 'Resume Analysis',
    '/resume-builder':   'Resume Builder',
    '/notes':            'Notes & Prep Space',
    '/progress-tracker': 'Progress Tracker',
    '/settings':         'Settings',
    '/interview':        'Interview Report',
};

const TopBar = ({ onMenuOpen }) => {
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    /* Find the best matching title */
    const pageTitle = Object.entries(PAGE_TITLES).find(([path]) =>
        path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(path)
    )?.[1] ?? 'IntelliPrep';

    const displayName = user?.fullName || user?.username || '';
    const avatar = user?.avatar || '';
    const initials = displayName.charAt(0).toUpperCase() || 'U';

    return (
        <header className="app-top-bar">
            {/* Left: hamburger (mobile only) + page title */}
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

            {/* Right: notification bell + single user avatar */}
            <div className="top-bar-right">
                <NotificationBell />

                <button
                    className="top-bar-user-btn"
                    onClick={() => navigate('/settings')}
                    title="Profile & Settings"
                >
                    {avatar ? (
                        <img
                            className="top-bar-avatar"
                            src={avatar}
                            alt={displayName}
                        />
                    ) : (
                        <div className="top-bar-avatar top-bar-avatar--initials">
                            {initials}
                        </div>
                    )}
                    {displayName && (
                        <span className="top-bar-username">{displayName}</span>
                    )}
                </button>
            </div>
        </header>
    );
};

export default TopBar;
