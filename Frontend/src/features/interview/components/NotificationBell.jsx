import React, { useEffect, useMemo, useRef, useState } from "react"
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../services/progress.api"
import "../style/progress-tracker.scss"

/* NotificationBell — bell icon only. User profile is handled by TopBar. */
const NotificationBell = () => {
    const [notifications, setNotifications] = useState([])
    const [showNotifications, setShowNotifications] = useState(false)
    const [tick, setTick] = useState(Date.now())
    const panelRef = useRef(null)
    const btnRef = useRef(null)

    const loadNotifications = async () => {
        try {
            const response = await getNotifications()
            setNotifications(response?.notifications || [])
        } catch (_) {}
    }

    useEffect(() => { loadNotifications() }, [])

    useEffect(() => {
        const timer = setInterval(() => setTick(Date.now()), 15000)
        return () => clearInterval(timer)
    }, [])

    /* Close panel on outside click */
    useEffect(() => {
        if (!showNotifications) return
        const handle = (e) => {
            if (
                panelRef.current && !panelRef.current.contains(e.target) &&
                btnRef.current && !btnRef.current.contains(e.target)
            ) {
                setShowNotifications(false)
            }
        }
        document.addEventListener("mousedown", handle)
        return () => document.removeEventListener("mousedown", handle)
    }, [showNotifications])

    const visibleNotifications = useMemo(() => {
        const now = Date.now()
        return notifications.filter((item) => {
            if (!item.readAt) return true
            return now - new Date(item.readAt).getTime() <= 60 * 1000
        })
    }, [notifications, tick])

    const unreadCount = useMemo(
        () => visibleNotifications.filter((item) => !item.readAt).length,
        [visibleNotifications]
    )

    return (
        <div style={{ position: 'relative' }}>
            {/* ── Bell button ── */}
            <button
                ref={btnRef}
                type="button"
                className="notif-icon-btn"
                onClick={() => setShowNotifications((prev) => !prev)}
                title="Alerts"
                aria-label="Notifications"
                style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: 0
                }}
            >
                <span
                    className="notif-bell"
                    aria-hidden="true"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: 'rgba(97, 137, 169, 0.15)',
                        color: '#9fd0f4',
                        transition: 'all 0.2s'
                    }}
                >
                    <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                        <path d="M12 4C8.9 4 6.5 6.4 6.5 9.5V13.1L5 16h14l-1.5-2.9V9.5C18.5 6.4 16.1 4 13 4H12z" stroke="currentColor" strokeWidth="2.2" />
                        <path d="M9.5 18a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    </svg>
                </span>
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '-2px',
                        right: '-2px',
                        background: '#e74c3c',
                        color: '#fff',
                        fontSize: '0.55rem',
                        padding: '0.1rem 0.3rem',
                        borderRadius: '10px',
                        fontWeight: 'bold',
                        border: '1px solid #090e15',
                        zIndex: 10,
                        lineHeight: 1
                    }}>
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* ── Notification panel — uses CSS class for mobile safe positioning ── */}
            {showNotifications && (
                <div
                    ref={panelRef}
                    className="notif-panel"
                >
                    {/* Header */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.75rem',
                        paddingBottom: '0.5rem',
                        borderBottom: '1px solid rgba(146, 173, 196, 0.12)'
                    }}>
                        <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#eaf2f8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: '#9fd0f4' }}>notifications</span>
                            Alerts
                        </h3>
                        <button
                            type="button"
                            onClick={async () => { await markAllNotificationsRead(); await loadNotifications() }}
                            style={{
                                background: 'rgba(97, 137, 169, 0.15)',
                                border: '1px solid rgba(146, 173, 196, 0.18)',
                                color: '#9fd0f4',
                                fontSize: '0.68rem',
                                cursor: 'pointer',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px'
                            }}
                        >
                            Mark All Read
                        </button>
                    </div>

                    {/* List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto', maxHeight: '55vh' }}>
                        {!visibleNotifications.length && (
                            <p style={{ margin: 0, fontSize: '0.78rem', color: '#6b7d8e', textAlign: 'center', padding: '1.5rem 0' }}>
                                No notifications yet.
                            </p>
                        )}
                        {visibleNotifications.map((item) => (
                            <div
                                key={item._id}
                                style={{
                                    border: '1px solid rgba(146, 173, 196, 0.12)',
                                    background: item.readAt ? 'rgba(9, 14, 21, 0.6)' : 'rgba(55, 90, 120, 0.18)',
                                    borderRadius: '0.5rem',
                                    padding: '0.6rem 0.75rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.2rem',
                                    transition: 'background 0.15s'
                                }}
                            >
                                <strong style={{ fontSize: '0.78rem', color: item.readAt ? '#8eadc4' : '#eaf2f8' }}>
                                    {item.title}
                                </strong>
                                <p style={{ margin: 0, fontSize: '0.7rem', color: 'rgba(196, 218, 237, 0.8)', lineHeight: 1.4 }}>
                                    {item.message}
                                </p>
                                <small style={{ fontSize: '0.6rem', color: 'rgba(140, 170, 195, 0.6)' }}>
                                    {new Date(item.createdAt).toLocaleString()}
                                </small>
                                {!item.readAt && (
                                    <button
                                        type="button"
                                        style={{
                                            marginTop: '0.15rem',
                                            alignSelf: 'flex-start',
                                            border: '1px solid rgba(143, 180, 210, 0.25)',
                                            background: 'rgba(97, 137, 169, 0.15)',
                                            color: '#9fd0f4',
                                            borderRadius: '0.3rem',
                                            padding: '0.1rem 0.35rem',
                                            fontSize: '0.6rem',
                                            cursor: 'pointer'
                                        }}
                                        onClick={async () => { await markNotificationRead(item._id); await loadNotifications() }}
                                    >
                                        Mark Read
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export default NotificationBell
