import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useLocation } from "react-router"
import { useAuth } from "../../auth/hooks/useAuth"

const Sidebar = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const { handleLogout } = useAuth()
    
    const onLogout = async () => {
        const result = await handleLogout()
        if (result?.ok) navigate("/login")
    }

    const isActive = (path) => {
        if (path === "/" && location.pathname === "/") return true;
        if (path !== "/" && location.pathname.startsWith(path)) return true;
        return false;
    }

    return (
        <aside className="dashboard-sidebar">
            <div className="brand-block">
                <img className="brand-mark" src="/mind-icon.svg" alt="IntelliPrep logo" onError={(e) => { e.target.style.display = 'none' }} />
                <h2>IntelliPrep</h2>
            </div>
            
            <nav className="sidebar-nav" style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                <button className={`nav-item ${isActive("/dashboard") ? "nav-item--active" : ""}`} type="button" onClick={() => navigate("/dashboard")} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>dashboard</span>
                    Dashboard
                </button>
                <button className={`nav-item ${isActive("/") ? "nav-item--active" : ""}`} type="button" onClick={() => navigate("/")} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>analytics</span>
                    Resume Analysis
                </button>
                <button className={`nav-item ${isActive("/resume-builder") ? "nav-item--active" : ""}`} type="button" onClick={() => navigate("/resume-builder")} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>edit_document</span>
                    Resume Builder
                </button>
                <button className={`nav-item ${isActive("/notes") ? "nav-item--active" : ""}`} type="button" onClick={() => navigate("/notes")} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>book</span>
                    Notes / Prep Space
                </button>
                <button className={`nav-item ${isActive("/progress-tracker") ? "nav-item--active" : ""}`} type="button" onClick={() => navigate("/progress-tracker")} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>monitoring</span>
                    Track Your Progress
                </button>
                <button className={`nav-item ${isActive("/settings") ? "nav-item--active" : ""}`} type="button" onClick={() => navigate("/settings")} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>settings</span>
                    Settings
                </button>
            </nav>
            
            <div className="sidebar-footer" style={{ marginTop: 'auto', marginBottom: '2rem' }}>
                <button className="logout-btn" onClick={onLogout} type="button" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', justifyContent: 'center' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>logout</span>
                    Logout
                </button>
            </div>
        </aside>
    )
}

export default Sidebar
