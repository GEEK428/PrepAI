import React from 'react';
import NotificationBell from './NotificationBell';
import { useAuth } from '../../auth/hooks/useAuth';
import { useLocation, useNavigate } from 'react-router';

/* Map route → page title */
const PAGE_TITLES = {
    '/dashboard':        { title: 'Dashboard', desc: 'Welcome back to your preparation hub.' },
    '/':                 { title: 'Resume Analysis', desc: 'Detailed skill gap analysis and tailored interview prep.' },
    '/resume-optimizer': { title: 'Resume Optimizer', desc: 'Tailor your professional profile for specific roles.' },
    '/resume-builder':   { title: 'Resume Optimizer', desc: 'Tailor your professional profile for specific roles.' },
    '/notes':            { title: 'Notes & Prep Space', desc: 'Master core concepts and manage your interview bank.' },
    '/progress-tracker': { title: 'Progress Tracker', desc: 'Monitor your growth and achieve your career goals.' },
    '/settings':         { title: 'Settings', desc: 'Manage your profile and application preferences.' },
    '/interview':        { title: 'Interview Report', desc: 'In-depth assessment and preparation roadmap.' },
};

const TopBar = ({ onMenuOpen }) => {
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const pageInfo = Object.entries(PAGE_TITLES).find(([path]) =>
        path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(path)
    )?.[1] ?? { title: 'IntelliPrep', desc: 'Accelerate your career preparation.' };

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
                <div className="top-bar-branding">
                    <h2 className="top-bar-title">{pageInfo.title}</h2>
                    <p className="top-bar-desc">{pageInfo.desc}</p>
                </div>
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
