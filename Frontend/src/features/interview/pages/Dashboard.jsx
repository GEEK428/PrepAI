import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { useInterview } from "../hooks/useInterview"
import { useAuth } from "../../auth/hooks/useAuth"
import { getNotes } from "../services/notes.api"
import { getProgressOverview } from "../services/progress.api"
import "../style/home.scss"
import Sidebar from "../components/Sidebar"
import NotificationBell from "../components/NotificationBell"

const Dashboard = () => {
    const navigate = useNavigate()
    const { user } = useAuth()
    const { loading, reports, getReports, getDashboardStats } = useInterview()
    
    const [radarData, setRadarData] = useState({ topStrengths: [], recurringGaps: [], totalAnalyzed: 0 })
    const [radarLoading, setRadarLoading] = useState(false)
    const [notesData, setNotesData] = useState([])
    const [resumesOptimized, setResumesOptimized] = useState(0)
    const [goalsData, setGoalsData] = useState([])

    useEffect(() => {
        document.title = "Dashboard | IntelliPrep"
        loadData()
    }, [])

    const loadData = async () => {
        getReports()
        setRadarLoading(true)
        const stats = await getDashboardStats()
        if (stats) setRadarData(stats)
        setRadarLoading(false)

        try {
            const data = await getNotes({ view: "all" })
            if (data?.notes) {
                setNotesData(data.notes)
            }
        } catch (e) { console.error(e) }

        try {
            const currentYear = new Date().getFullYear();
            const progressResp = await getProgressOverview(currentYear);
            if (progressResp?.goals) {
                setGoalsData(progressResp.goals);
            }
        } catch (err) { console.error(err) }
    }

    useEffect(() => {
        try {
            const hist = JSON.parse(localStorage.getItem("intelliprep_resume_download_history") || "[]")
            setResumesOptimized(hist.length)
        } catch (e) {}
    }, [])

    const targetTitle = user?.targetJob || "None"
    const targetCompany = user?.targetCompany ? `@ ${user.targetCompany}` : ""
    const totalReports = reports?.length || 0
    
    // Analytics Calculation
    let avgMatchScore = 0
    let matchScoreTrend = 0
    if (reports?.length > 0) {
        const scores = reports.filter(r => r.matchScore > 0).map(r => r.matchScore)
        if (scores.length > 0) {
            avgMatchScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            if (scores.length >= 2) {
                const mid = Math.ceil(scores.length / 2)
                const recentHalf = scores.slice(0, mid)
                const olderHalf = scores.slice(mid)
                const recentAvg = recentHalf.reduce((a, b) => a + b, 0) / recentHalf.length
                const olderAvg = olderHalf.reduce((a, b) => a + b, 0) / olderHalf.length
                matchScoreTrend = Math.round(recentAvg - olderAvg)
            }
        }
    }

    const totalNotes = notesData.length
    const understoodCount = notesData.filter(n => n.status === "done").length
    const prepMastery = totalNotes > 0 ? Math.round((understoodCount / totalNotes) * 100) : 0

    const now = Date.now()
    const activeGoals = goalsData.filter(g => g.status !== "completed" && new Date(g.deadline).getTime() >= now).length

    return (
        <main className="dashboard-page">
            <Sidebar />

            <section className="dashboard-main" style={{ gap: '0.6rem' }}>
                <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.2rem' }}>
                    <div>
                        <p className="dashboard-kicker">WELCOME BACK, <span style={{color:"#eaf2f8", textTransform: 'none', fontWeight: 'bold'}}>{user?.fullName || user?.username || 'GUEST'}</span></p>
                        <h1 style={{fontSize: '1.2rem', marginTop: '0.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem'}}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.4rem', color: '#9fd0f4' }}>dashboard</span>
                            The Intelligence Dashboard
                        </h1>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <NotificationBell />
                    </div>
                </header>

                {/* ── High Level Stats Grid ── */}
                <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.6rem', marginBottom: '0.5rem' }}>
                    
                    <article className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', padding: '0.9rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <p className="stat-label" style={{fontSize: '0.6rem'}}>AVG MATCH SCORE</p>
                            <span className="material-symbols-outlined" style={{ color: '#6fb2e3', fontSize: '1rem' }}>analytics</span>
                        </div>
                        <h3 style={{ fontSize: '1.8rem', margin: '0.4rem 0 0', fontWeight: '700' }}>{avgMatchScore > 0 ? avgMatchScore : '--'}<span style={{ fontSize: '1rem', color: '#9fd0f4' }}>%</span></h3>
                        <p className="stat-note" style={{marginTop: 'auto', fontSize:'0.65rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: matchScoreTrend >= 0 ? '#b5e8b6' : '#ffb5af'}}>
                            {matchScoreTrend !== 0 && (
                                <span className="material-symbols-outlined" style={{fontSize: '0.9rem'}}>{matchScoreTrend > 0 ? 'trending_up' : 'trending_down'}</span>
                            )}
                            {matchScoreTrend > 0 ? `+${matchScoreTrend}% vs past` : matchScoreTrend < 0 ? `${matchScoreTrend}% vs past` : 'Baseline established'}
                        </p>
                    </article>
                    
                    <article className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', padding: '0.9rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <p className="stat-label" style={{fontSize: '0.6rem'}}>PREP MASTERY</p>
                            <span className="material-symbols-outlined" style={{ color: '#a5c4e0', fontSize: '1rem' }}>model_training</span>
                        </div>
                        <h3 style={{ fontSize: '1.8rem', margin: '0.4rem 0 0', fontWeight: '700' }}>{prepMastery}<span style={{ fontSize: '1rem', color: '#9fd0f4' }}>%</span></h3>
                        <p className="stat-note" style={{marginTop: 'auto', fontSize:'0.65rem', color: 'rgba(194, 214, 233, 0.7)'}}>Of {totalNotes} total notes marked "Understood"</p>
                    </article>
                    
                    <article className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', padding: '0.9rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <p className="stat-label" style={{fontSize: '0.6rem'}}>RESUMES OPTIMIZED</p>
                            <span className="material-symbols-outlined" style={{ color: '#a5c4e0', fontSize: '1rem' }}>description</span>
                        </div>
                        <h3 style={{ fontSize: '1.8rem', margin: '0.4rem 0 0', fontWeight: '700' }}>{resumesOptimized}</h3>
                        <p className="stat-note" style={{marginTop: 'auto', fontSize:'0.65rem', color: 'rgba(194, 214, 233, 0.7)'}}>Generated in Builder</p>
                    </article>
                    
                    <article className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', padding: '0.9rem', cursor: 'pointer' }} onClick={() => navigate('/progress-tracker')}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <p className="stat-label" style={{fontSize: '0.6rem'}}>ACTIVE GOALS</p>
                            <span className="material-symbols-outlined" style={{ color: '#ffb5af', fontSize: '1rem' }}>track_changes</span>
                        </div>
                        <h3 style={{ fontSize: '1.8rem', margin: '0.4rem 0 0', fontWeight: '700', color: activeGoals > 0 ? '#ffb5af' : '#eaf2f8' }}>{activeGoals}</h3>
                        <p className="stat-note" style={{marginTop: 'auto', fontSize:'0.65rem', color: 'rgba(194, 214, 233, 0.7)'}}>Yet to be completed</p>
                    </article>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <article className="stat-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0.6rem 0.8rem', background: 'rgba(20, 32, 45, 0.6)' }}>
                            <p className="stat-label" style={{fontSize: '0.55rem', marginBottom: '0.2rem'}}>TARGET ROLE</p>
                            <h3 style={{ fontSize: '0.85rem', lineHeight: '1.2', margin: 0, fontWeight: '600', color: '#eaf2f8', whiteSpace: 'normal', wordBreak: 'break-word' }}>{targetTitle || "None"}</h3>
                            <p style={{ fontSize: '0.65rem', lineHeight: '1.2', color: 'rgba(194, 214, 233, 0.7)', margin: '0.1rem 0 0', whiteSpace: 'normal', wordBreak: 'break-word' }}>{targetCompany || "Company not specified"}</p>
                        </article>
                        <button className="generate-btn" onClick={() => navigate('/')} style={{ padding: '0.4rem', display: 'flex', justifyContent: 'center', gap: '0.3rem', alignItems: 'center', width: '100%', borderRadius: '0.3rem', border: 'none', background: 'rgba(111, 178, 227, 0.15)', color: '#9fd0f4' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>add_circle</span>
                            <span style={{fontSize: '0.55rem', fontWeight: 'bold', letterSpacing: '0.05em'}}>NEW REPORT</span> 
                        </button>
                    </div>
                </div>

                {/* ── Middle Row: Progress Visuals & Recent ── */}
                <div className="dashboard-panels">
                    
                    {/* Progress Visuals (Bar Chart) */}
                    <article className="playcard-panel" style={{ display: 'flex', flexDirection: 'column', padding: '1rem' }}>
                        <div className="panel-heading" style={{ marginBottom: '1rem' }}>
                            <h2 style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9fd0f4', margin: 0 }}>Progress Visuals: Strengths vs. Recurring Gaps</h2>
                        </div>
                        
                        {radarLoading ? (
                            <div className="loading-pill" style={{ width: "fit-content", margin: "1rem 0" }}>Fetching stats...</div>
                        ) : radarData.topStrengths.length === 0 && radarData.recurringGaps.length === 0 ? (
                            <div className="empty-state" style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                <p style={{color: 'rgba(194, 214, 233, 0.6)', fontSize: '0.7rem'}}>Run an analysis to uncover strengths and gaps.</p>
                            </div>
                        ) : (
                            <div className="radar-grid">
                                {/* Strengths */}
                                <div>
                                    <h3 style={{ fontSize: '0.7rem', color: '#9fd0f4', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        <span className="material-symbols-outlined" style={{fontSize:'1rem'}}>verified</span> Consistently Matched
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                                        {radarData.topStrengths.map((skill, i) => {
                                            const maxCount = radarData.topStrengths[0].count;
                                            const percent = (skill.count / (maxCount || 1)) * 100;
                                            return (
                                                <div key={i}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginBottom: '0.2rem', color: '#eaf2f8' }}>
                                                        <span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80%'}}>{skill.name}</span>
                                                        <span style={{color: 'rgba(194, 214, 233, 0.6)'}}>{skill.count}x</span>
                                                    </div>
                                                    <div style={{ height: '4px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${percent}%`, background: '#6fb2e3', borderRadius: '2px', transition: 'width 0.5s ease-in-out' }} />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {radarData.topStrengths.length === 0 && <span style={{fontSize: '0.65rem', color: 'rgba(194, 214, 233, 0.6)'}}>No consistent strengths found yet.</span>}
                                    </div>
                                </div>

                                {/* Gaps */}
                                <div>
                                    <h3 style={{ fontSize: '0.7rem', color: '#ffb5af', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        <span className="material-symbols-outlined" style={{fontSize:'1rem'}}>warning</span> Recurring Skill Gaps
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                                        {radarData.recurringGaps.map((gap, i) => {
                                            const maxCount = radarData.recurringGaps[0].count;
                                            const percent = (gap.count / (maxCount || 1)) * 100;
                                            return (
                                                <div key={i}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginBottom: '0.2rem', color: '#eaf2f8' }}>
                                                        <span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80%'}}>{gap.name}</span>
                                                        <span style={{color: 'rgba(194, 214, 233, 0.6)'}}>{gap.count}x miss</span>
                                                    </div>
                                                    <div style={{ height: '4px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${percent}%`, background: '#ff7769', borderRadius: '2px', transition: 'width 0.5s ease-in-out' }} />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {radarData.recurringGaps.length === 0 && <span style={{fontSize: '0.65rem', color: 'rgba(194, 214, 233, 0.6)'}}>No recurring gaps found!</span>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </article>

                    {/* Recent Reports */}
                    <article className="reports-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column' }}>
                        <div className="panel-heading" style={{ borderBottom: '1px solid rgba(146, 173, 196, 0.1)', paddingBottom: '0.6rem', marginBottom: '0.6rem' }}>
                            <h2 style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#eaf2f8', margin: 0 }}>Recent Reports</h2>
                        </div>
                        
                        {reports?.length === 0 ? (
                            <div className="empty-state" style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                <p style={{color: 'rgba(194, 214, 233, 0.6)', fontSize: '0.7rem'}}>No recent activity.</p>
                            </div>
                        ) : (
                            <div className="report-list" style={{ gap: '0', flex: 1, alignContent: 'flex-start' }}>
                                {reports?.slice(0, 4).map((report, idx) => {
                                    const icons = ["fact_check", "description", "history", "analytics"]
                                    const iconName = icons[idx % icons.length]
                                    return (
                                        <div key={report._id} className="report-item" onClick={() => navigate(`/interview/${report._id}`)} style={{ cursor: 'pointer', padding: '0.5rem 0.2rem', background: 'transparent', border: 'none', borderBottom: idx < 3 ? '1px solid rgba(146, 173, 196, 0.08)' : 'none', borderRadius: 0, gridTemplateColumns: 'auto 1fr', gap: '0.6rem' }}>
                                            <div style={{ width: '1.6rem', height: '1.6rem', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', display: 'grid', placeItems: 'center' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '0.9rem', color: 'rgba(194, 214, 233, 0.8)' }}>{iconName}</span>
                                            </div>
                                            <div className="report-meta">
                                                <h3 style={{ fontSize: '0.7rem', margin: '0 0 0.1rem', color: '#eaf2f8', fontWeight: '500' }}>{report.title || 'Assessment'}</h3>
                                                <p style={{ fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.02em', color: 'rgba(194, 214, 233, 0.6)' }}>
                                                    {report.matchScore ? `COMPLETED • ${report.matchScore}%` : 'COMPLETED'}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                        <button className="history-more-btn" onClick={() => navigate('/')} style={{ marginTop: '0.6rem', width: '100%', background: 'transparent', border: '1px solid rgba(146, 173, 196, 0.1)', color: '#9fd0f4', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '500', padding: '0.5rem', fontSize: '0.6rem' }}>
                            VIEW ALL ACTIVITY
                        </button>
                    </article>
                </div>

            </section>
        </main>
    )
}

export default Dashboard
