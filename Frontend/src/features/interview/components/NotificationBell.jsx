import React, { useEffect, useMemo, useState, useRef } from "react"
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../services/progress.api"
import { useAuth } from "../../auth/hooks/useAuth"
import { useNavigate } from "react-router"
import "../style/progress-tracker.scss"

const NotificationBell = () => {
    const { user, handleLogout } = useAuth()
    const navigate = useNavigate()
    const displayName = user?.username || user?.displayName || user?.email?.split("@")[0] || "User"
    const avatar = user?.avatar || ""

    const [notifications, setNotifications] = useState([])
    const [showNotifications, setShowNotifications] = useState(false)
    const [showProfileMenu, setShowProfileMenu] = useState(false)
    const [tick, setTick] = useState(Date.now())
    const profileRef = useRef(null)

    const onLogout = async () => {
        const result = await handleLogout()
        if (result?.ok) navigate("/login")
    }

    // click outside listener for profile menu
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target)) {
                setShowProfileMenu(false)
            }
        }
        if (showProfileMenu) {
            document.addEventListener("mousedown", handleClickOutside)
        }
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [showProfileMenu])

    const loadNotifications = async () => {
        try {
            const response = await getNotifications()
            setNotifications(response?.notifications || [])
        } catch (_) {
            // no-op
        }
    }

    useEffect(() => {
        loadNotifications()
    }, [])

    useEffect(() => {
        const timer = setInterval(() => setTick(Date.now()), 15000)
        return () => clearInterval(timer)
    }, [])

    const visibleNotifications = useMemo(() => {
        const now = Date.now()
        return notifications.filter((item) => {
            if (!item.readAt) return true
            return now - new Date(item.readAt).getTime() <= 60 * 1000
        })
    }, [ notifications, tick ])

    const unreadVisibleCount = useMemo(
        () => visibleNotifications.filter((item) => !item.readAt).length,
        [ visibleNotifications ]
    )

    return (
        <div className="head-actions" style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', marginLeft: 'auto' }}>
            {/* User Profile Info with Dropdown */}
            <div style={{ position: 'relative' }} ref={profileRef}>
                <div 
                    onClick={() => setShowProfileMenu(prev => !prev)}
                    style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.6rem', 
                        cursor: 'pointer',
                        padding: '0.25rem 0.6rem 0.25rem 0.4rem',
                        borderRadius: '2rem',
                        transition: 'background 0.2s',
                        background: showProfileMenu ? 'rgba(97, 137, 169, 0.15)' : 'transparent'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(97, 137, 169, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = showProfileMenu ? 'rgba(97, 137, 169, 0.15)' : 'transparent'}
                >
                    {avatar ? (
                        <img src={avatar} alt="User Avatar" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(146, 173, 196, 0.4)' }} />
                    ) : (
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #6189a9, #385d7a)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '1rem', border: '1px solid rgba(146, 173, 196, 0.4)' }}>
                            {displayName.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <span style={{ fontSize: '0.85rem', color: '#eaf3fb', fontWeight: '500' }}>{displayName}</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: '#8fb4d2' }}>expand_more</span>
                </div>

                {/* Profile Popup */}
                {showProfileMenu && (
                    <div style={{
                        position: 'absolute',
                        top: '120%',
                        right: 0,
                        width: '180px',
                        background: 'linear-gradient(145deg, rgba(24, 40, 56, 0.98), rgba(10, 18, 27, 0.99))',
                        border: '1px solid rgba(146, 173, 196, 0.24)',
                        borderRadius: '0.6rem',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
                        zIndex: 1000,
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <button 
                            type="button" 
                            onClick={() => { setShowProfileMenu(false); navigate("/settings") }} 
                            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1rem', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(146, 173, 196, 0.15)', color: '#d0e1ef', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left', outline: 'none' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(97, 137, 169, 0.15)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>settings</span>
                            Settings
                        </button>
                        <button 
                            type="button" 
                            onClick={onLogout} 
                            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1rem', background: 'transparent', border: 'none', color: '#ff6b6b', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left', outline: 'none' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 107, 107, 0.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>logout</span>
                            Logout
                        </button>
                    </div>
                )}
            </div>

            <button type="button" className="notif-icon-btn" onClick={() => setShowNotifications((prev) => !prev)} title="Alerts" style={{ position: 'relative', display: 'flex', alignItems: 'center', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}>
                <span className="notif-bell" aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(97, 137, 169, 0.15)', color: '#9fd0f4', transition: 'all 0.2s' }}>
                    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                        <path d="M12 4C8.9 4 6.5 6.4 6.5 9.5V13.1L5 16h14l-1.5-2.9V9.5C18.5 6.4 16.1 4 13 4H12z" stroke="currentColor" strokeWidth="2.2" />
                        <path d="M9.5 18a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    </svg>
                </span>
                {unreadVisibleCount > 0 && (
                    <span style={{ position: 'absolute', bottom: '-2px', right: '-2px', background: '#e74c3c', color: '#fff', fontSize: '0.6rem', padding: '0.1rem 0.35rem', borderRadius: '10px', fontWeight: 'bold', border: '1px solid #14212e', zIndex: 10 }}>{unreadVisibleCount}</span>
                )}
            </button>
            
            {showNotifications && (
                <section className="history-modal-overlay notif-modal-overlay" onClick={() => setShowNotifications(false)}>
                    <article className="history-modal notif-modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(380px, calc(100vw - 2rem))', position: 'absolute', top: '70px', right: 'clamp(0.5rem, 2vw, 1.5rem)', maxHeight: '70vh', zIndex: 1000, padding: '1rem', background: 'linear-gradient(145deg, rgba(24, 40, 56, 0.98), rgba(10, 18, 27, 0.99))', border: '1px solid rgba(146, 173, 196, 0.24)', borderRadius: '0.85rem', boxShadow: '0 12px 30px rgba(0, 0, 0, 0.3)' }}>
                    <div className="progress-card__head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 0.8rem 0', paddingBottom: '0.4rem', borderBottom: '1px solid rgba(146, 173, 196, 0.16)' }}>
                        <h3 style={{ margin: 0, fontSize: '0.95rem' }}>
                            <span className="notif-title-icon" aria-hidden="true" style={{ marginRight: '0.5rem' }}>
                                <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                                    <path d="M12 4C8.9 4 6.5 6.4 6.5 9.5V13.1L5 16h14l-1.5-2.9V9.5C18.5 6.4 16.1 4 13 4H12z" stroke="currentColor" strokeWidth="1.8" />
                                </svg>
                            </span>
                            Alerts Center
                        </h3>
                        <button type="button" onClick={async () => {
                            await markAllNotificationsRead()
                            await loadNotifications()
                        }} className="mark-all-read-btn" style={{ background: 'rgba(97, 137, 169, 0.15)', border: '1px solid rgba(146, 173, 196, 0.2)', color: '#9fd0f4', fontSize: '0.72rem', cursor: 'pointer', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                            Mark All Read
                        </button>
                    </div>
                    <div className="notification-list" style={{ display: 'grid', gap: '0.5rem', overflowY: 'auto', maxHeight: '55vh', paddingRight: '0.2rem' }}>
                        {!visibleNotifications.length && <p className="notes-meta">No notifications yet.</p>}
                        {visibleNotifications.map((item) => (
                            <article
                                key={item._id}
                                className={`notification-item ${item.readAt ? "read" : "unread"}`}
                                style={{
                                    border: '1px solid rgba(146, 173, 196, 0.22)',
                                    background: item.readAt ? 'rgba(88, 121, 151, 0.05)' : 'rgba(88, 121, 151, 0.15)',
                                    borderRadius: '0.55rem',
                                    padding: '0.62rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.2rem'
                                }}
                            >
                                <strong style={{ fontSize: '0.8rem', color: item.readAt ? '#a2cddf' : '#ffffff' }}>{item.title}</strong>
                                <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(208, 225, 239, 0.82)' }}>{item.message}</p>
                                <small style={{ fontSize: '0.62rem', color: 'rgba(194, 214, 233, 0.72)' }}>{new Date(item.createdAt).toLocaleString()}</small>
                                {!item.readAt && (
                                    <button
                                        type="button"
                                        className="mark-read-btn"
                                        style={{ marginTop: '0.2rem', alignSelf: 'flex-start', border: '1px solid rgba(143, 180, 210, 0.3)', background: 'rgba(97, 137, 169, 0.2)', color: '#eaf3fb', borderRadius: '0.35rem', padding: '0.12rem 0.35rem', fontSize: '0.6rem', cursor: 'pointer' }}
                                        onClick={async () => {
                                            await markNotificationRead(item._id)
                                            await loadNotifications()
                                        }}
                                    >
                                        Mark Read
                                    </button>
                                )}
                            </article>
                        ))}
                    </div>
                    </article>
                </section>
            )}
        </div>
    )
}

export default NotificationBell
