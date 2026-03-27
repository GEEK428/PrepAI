import React, { useState } from "react"
import { useNavigate, useLocation } from "react-router"
import { useAuth } from "../../auth/hooks/useAuth"
import TopBar from "./TopBar"

const Sidebar = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const { handleLogout } = useAuth()
    const [isMobileOpen, setIsMobileOpen] = useState(false)

    const onLogout = async () => {
        const result = await handleLogout()
        if (result?.ok) navigate("/login")
    }

    const isActive = (path) => {
        if (path === "/" && location.pathname === "/") return true;
        if (path !== "/" && location.pathname.startsWith(path)) return true;
        return false;
    }

    const navItems = [
        { path: "/dashboard",        icon: "dashboard",       label: "Dashboard" },
        { path: "/",                 icon: "analytics",       label: "Resume Analysis" },
        { path: "/resume-builder",   icon: "edit_document",   label: "Resume Builder" },
        { path: "/notes",            icon: "book",            label: "Notes / Prep Space" },
        { path: "/progress-tracker", icon: "monitoring",      label: "Track Your Progress" },
        { path: "/settings",         icon: "settings",        label: "Settings" },
    ];

    const handleNav = (path) => {
        navigate(path);
        setIsMobileOpen(false);
    }

    return (
        <>
            {/* ── Unified Top Bar (visible on mobile, optional on desktop) ── */}
            <div className="mobile-top-bar">
                <TopBar onMenuOpen={() => setIsMobileOpen(true)} />
            </div>

            {/* ── Overlay backdrop ── */}
            {isMobileOpen && (
                <div
                    className="mobile-sidebar-overlay"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* ── Sidebar (desktop: always visible, mobile: slide-in) ── */}
            <aside className={`dashboard-sidebar ${isMobileOpen ? 'open' : ''}`}>

                {/* Sidebar header: logo + close btn */}
                <div className="sidebar-header-mobile">
                    <div className="brand-block">
                        <img
                            className="brand-mark"
                            src="/mind-icon.svg"
                            alt="IntelliPrep logo"
                            onError={(e) => { e.target.style.display = 'none' }}
                        />
                        <h2>IntelliPrep</h2>
                    </div>
                    <button
                        className="close-sidebar-btn"
                        onClick={() => setIsMobileOpen(false)}
                        aria-label="Close menu"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map(item => (
                        <button
                            key={item.path}
                            className={`nav-item ${isActive(item.path) ? "nav-item--active" : ""}`}
                            type="button"
                            onClick={() => handleNav(item.path)}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>
                                {item.icon}
                            </span>
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="sidebar-footer" style={{ marginTop: 'auto', marginBottom: '2rem' }}>
                    <button
                        className="logout-btn"
                        onClick={onLogout}
                        type="button"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', justifyContent: 'center' }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>logout</span>
                        Logout
                    </button>
                </div>
            </aside>
        </>
    )
}

export default Sidebar
