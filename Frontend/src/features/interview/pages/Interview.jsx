import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { useInterview } from "../hooks/useInterview"
import Sidebar from "../components/Sidebar"
import NotificationBell from "../components/NotificationBell"
import Loader from "../../../components/Loader"
import "../style/home.scss"
import "../style/interview.scss"

const Interview = () => {
    const navigate = useNavigate()
    const { interviewId } = useParams()
    const { report, getReportById, loading } = useInterview()
    const [activeTab, setActiveTab] = useState("technical")

    useEffect(() => {
        if (interviewId) {
            getReportById(interviewId)
        }
    }, [ interviewId ])

    useEffect(() => {
        document.title = "Report | IntelliPrep"
    }, [])

    const safeReport = useMemo(() => {
        if (!report) return null
        return {
            title: report.title || "Interview Report",
            matchScore: Number(report.matchScore || 0),
            topSkills: Array.isArray(report.topSkills) ? report.topSkills : [],
            skillGaps: Array.isArray(report.skillGaps) ? report.skillGaps : [],
            technicalQuestions: Array.isArray(report.technicalQuestions) ? report.technicalQuestions : [],
            behavioralQuestions: Array.isArray(report.behavioralQuestions) ? report.behavioralQuestions : [],
            preparationPlan: Array.isArray(report.preparationPlan) ? report.preparationPlan : []
        }
    }, [ report ])

    if (loading || !safeReport) {
        return (
            <main className="dashboard-page loading-state">
                <Sidebar />
                <section className="dashboard-main interview-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Loader message="Loading your strategy..." />
                </section>
            </main>
        )
    }

    return (
        <main className="dashboard-page">
            <Sidebar />

            <section className="dashboard-main interview-main">
                <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ fontSize: '1.4rem', margin: 0, marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.6rem', color: '#9fd0f4' }}>analytics</span>
                            {safeReport.title}
                        </h1>
                        <p className="dashboard-subtitle" style={{ maxWidth: '600px', lineHeight: '1.4', fontSize: '0.8rem' }}>Your detailed match report with strengths, skill gaps, practice questions, and a preparation roadmap.</p>
                    </div>
                    <NotificationBell />
                </header>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    <section className="interview-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem' }}>
                        <article className="stat-card" style={{ background: 'linear-gradient(145deg, rgba(88, 121, 151, 0.1), rgba(10, 18, 27, 0.2))', border: '1px solid rgba(146, 173, 196, 0.2)', borderRadius: '0.6rem', padding: '1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', color: '#6fb2e3' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.5rem' }}>target</span>
                            </div>
                            <h3 style={{ fontSize: '1.8rem', margin: '0', color: '#ffffff' }}>{safeReport.matchScore}%</h3>
                            <p className="stat-label" style={{ margin: 0, fontWeight: 'bold', fontSize: '0.8rem' }}>Match Score</p>
                            <span className="stat-note" style={{ color: 'rgba(234, 243, 251, 0.7)', fontSize: '0.65rem' }}>Profile fit for target role</span>
                        </article>
                        <article className="stat-card" style={{ background: 'linear-gradient(145deg, rgba(88, 121, 151, 0.1), rgba(10, 18, 27, 0.2))', border: '1px solid rgba(146, 173, 196, 0.2)', borderRadius: '0.6rem', padding: '1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', color: '#4CAF50' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.5rem' }}>military_tech</span>
                            </div>
                            <h3 style={{ fontSize: '1.8rem', margin: '0', color: '#ffffff' }}>{safeReport.topSkills.length}</h3>
                            <p className="stat-label" style={{ margin: 0, fontWeight: 'bold', fontSize: '0.8rem' }}>Top Skills</p>
                            <span className="stat-note" style={{ color: 'rgba(234, 243, 251, 0.7)', fontSize: '0.65rem' }}>Strongly aligned areas</span>
                        </article>
                        <article className="stat-card" style={{ background: 'linear-gradient(145deg, rgba(88, 121, 151, 0.1), rgba(10, 18, 27, 0.2))', border: '1px solid rgba(146, 173, 196, 0.2)', borderRadius: '0.6rem', padding: '1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', color: '#ff6b6b' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.5rem' }}>psychology_alt</span>
                            </div>
                            <h3 style={{ fontSize: '1.8rem', margin: '0', color: '#ffffff' }}>{safeReport.skillGaps.length}</h3>
                            <p className="stat-label" style={{ margin: 0, fontWeight: 'bold', fontSize: '0.8rem' }}>Skill Gaps</p>
                            <span className="stat-note" style={{ color: 'rgba(234, 243, 251, 0.7)', fontSize: '0.65rem' }}>Key areas to improve</span>
                        </article>
                    </section>

                    <section className="interview-insights" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.8rem' }}>
                        <article className="playcard-panel" style={{ background: 'rgba(24, 40, 56, 0.5)', padding: '1rem', borderRadius: '0.6rem', border: '1px solid rgba(146, 173, 196, 0.15)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.8rem' }}>
                                <span className="material-symbols-outlined" style={{ color: '#67d7ac', fontSize: '1.1rem' }}>done_all</span>
                                <h2 style={{ fontSize: '0.9rem', margin: 0 }}>Top Skills Discovered</h2>
                            </div>
                            <div className="chip-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                {safeReport.topSkills.length
                                    ? safeReport.topSkills.map((skill, i) => <span key={i} className="skill-chip ok" style={{ background: 'rgba(103, 215, 172, 0.15)', color: '#67d7ac', padding: '0.25rem 0.6rem', borderRadius: '1.5rem', fontSize: '0.75rem', border: '1px solid rgba(103, 215, 172, 0.3)' }}>{skill}</span>)
                                    : <span className="stat-note" style={{ fontSize: '0.75rem' }}>No top skills identified.</span>}
                            </div>
                        </article>
                        
                        <article className="playcard-panel" style={{ background: 'rgba(24, 40, 56, 0.5)', padding: '1rem', borderRadius: '0.6rem', border: '1px solid rgba(146, 173, 196, 0.15)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.8rem' }}>
                                <span className="material-symbols-outlined" style={{ color: '#ffb9b3', fontSize: '1.1rem' }}>warning</span>
                                <h2 style={{ fontSize: '0.9rem', margin: 0 }}>Identified Skill Gaps</h2>
                            </div>
                            <div className="chip-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                {safeReport.skillGaps.length
                                    ? safeReport.skillGaps.map((gap, i) => (
                                        <span key={i} className={`skill-chip gap ${gap?.severity || "medium"}`} style={{ background: 'rgba(255, 185, 179, 0.15)', color: '#ffb9b3', padding: '0.25rem 0.6rem', borderRadius: '1.5rem', fontSize: '0.75rem', border: '1px solid rgba(255, 185, 179, 0.3)' }}>
                                            {gap?.skill || "Unnamed Gap"}
                                        </span>
                                    ))
                                    : <span className="stat-note" style={{ fontSize: '0.75rem' }}>No skill gaps identified.</span>}
                            </div>
                        </article>
                    </section>

                    <article style={{ background: 'rgba(24, 40, 56, 0.4)', borderRadius: '0.6rem', border: '1px solid rgba(146, 173, 196, 0.2)', overflow: 'hidden' }}>
                        <section className="report-tabs" style={{ display: 'flex', borderBottom: '1px solid rgba(146, 173, 196, 0.2)', background: 'rgba(10, 18, 27, 0.4)' }}>
                            <button type="button" onClick={() => setActiveTab("technical")} style={{ flex: 1, padding: '0.8rem', background: activeTab === 'technical' ? 'transparent' : 'rgba(0,0,0,0.1)', border: 'none', borderBottom: activeTab === 'technical' ? '2px solid #6fb2e3' : '2px solid transparent', color: activeTab === 'technical' ? '#ffffff' : 'rgba(234, 243, 251, 0.7)', fontSize: '0.85rem', fontWeight: activeTab === 'technical' ? 'bold' : 'normal', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>code</span> Technical Focus
                            </button>
                            <button type="button" onClick={() => setActiveTab("behavioral")} style={{ flex: 1, padding: '0.8rem', background: activeTab === 'behavioral' ? 'transparent' : 'rgba(0,0,0,0.1)', border: 'none', borderBottom: activeTab === 'behavioral' ? '2px solid #6fb2e3' : '2px solid transparent', color: activeTab === 'behavioral' ? '#ffffff' : 'rgba(234, 243, 251, 0.7)', fontSize: '0.85rem', fontWeight: activeTab === 'behavioral' ? 'bold' : 'normal', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>forum</span> Behavioral Fit
                            </button>
                            <button type="button" onClick={() => setActiveTab("roadmap")} style={{ flex: 1, padding: '0.8rem', background: activeTab === 'roadmap' ? 'transparent' : 'rgba(0,0,0,0.1)', border: 'none', borderBottom: activeTab === 'roadmap' ? '2px solid #6fb2e3' : '2px solid transparent', color: activeTab === 'roadmap' ? '#ffffff' : 'rgba(234, 243, 251, 0.7)', fontSize: '0.85rem', fontWeight: activeTab === 'roadmap' ? 'bold' : 'normal', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>map</span> Strategic Roadmap
                            </button>
                        </section>

                        <div style={{ padding: '1rem' }}>
                            {activeTab === "technical" && (
                                <section className="q-list-grid" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                    {safeReport.technicalQuestions.map((q, idx) => (
                                        <article className="q-playcard" key={`t-${idx}`} style={{ background: 'rgba(88, 121, 151, 0.08)', padding: '0.8rem', borderRadius: '0.5rem', borderLeft: '3px solid rgba(111, 178, 227, 0.6)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
                                                <span className="q-tag" style={{ background: 'rgba(111, 178, 227, 0.2)', color: '#6fb2e3', padding: '0.15rem 0.4rem', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Q-{idx + 1}</span>
                                                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#b7d2e8', fontWeight: '500' }}>{q.question}</h4>
                                            </div>
                                            <div style={{ paddingLeft: '0.4rem', borderLeft: '2px dashed rgba(111, 178, 227, 0.2)', marginLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                <div>
                                                    <span style={{ display: 'block', color: '#6fb2e3', fontSize: '0.65rem', fontWeight: 'bold', letterSpacing: '0.05em', marginBottom: '0.1rem' }}>INTENTION</span>
                                                    <p style={{ margin: 0, color: 'rgba(234, 243, 251, 0.75)', lineHeight: '1.4', fontSize: '0.8rem' }}>{q.intention}</p>
                                                </div>
                                                <div>
                                                    <span style={{ display: 'block', color: '#6fb2e3', fontSize: '0.65rem', fontWeight: 'bold', letterSpacing: '0.05em', marginBottom: '0.1rem' }}>APPROACH</span>
                                                    <p style={{ margin: 0, color: 'rgba(234, 243, 251, 0.75)', lineHeight: '1.4', fontSize: '0.8rem' }}>{q.answer}</p>
                                                </div>
                                            </div>
                                        </article>
                                    ))}
                                    {!safeReport.technicalQuestions.length && <p className="stat-note" style={{ textAlign: 'center', padding: '1.5rem', fontSize: '0.8rem' }}>No technical questions available.</p>}
                                </section>
                            )}

                            {activeTab === "behavioral" && (
                                <section className="q-list-grid" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                    {safeReport.behavioralQuestions.map((q, idx) => (
                                        <article className="q-playcard" key={`b-${idx}`} style={{ background: 'rgba(88, 121, 151, 0.08)', padding: '0.8rem', borderRadius: '0.5rem', borderLeft: '3px solid rgba(162, 205, 223, 0.6)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
                                                <span className="q-tag" style={{ background: 'rgba(162, 205, 223, 0.2)', color: '#a2cddf', padding: '0.15rem 0.4rem', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Q-{idx + 1}</span>
                                                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#b7d2e8', fontWeight: '500' }}>{q.question}</h4>
                                            </div>
                                            <div style={{ paddingLeft: '0.4rem', borderLeft: '2px dashed rgba(162, 205, 223, 0.2)', marginLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                <div>
                                                    <span style={{ display: 'block', color: '#a2cddf', fontSize: '0.65rem', fontWeight: 'bold', letterSpacing: '0.05em', marginBottom: '0.1rem' }}>INTENTION</span>
                                                    <p style={{ margin: 0, color: 'rgba(234, 243, 251, 0.75)', lineHeight: '1.4', fontSize: '0.8rem' }}>{q.intention}</p>
                                                </div>
                                                <div>
                                                    <span style={{ display: 'block', color: '#a2cddf', fontSize: '0.65rem', fontWeight: 'bold', letterSpacing: '0.05em', marginBottom: '0.1rem' }}>APPROACH</span>
                                                    <p style={{ margin: 0, color: 'rgba(234, 243, 251, 0.75)', lineHeight: '1.4', fontSize: '0.8rem' }}>{q.answer}</p>
                                                </div>
                                            </div>
                                        </article>
                                    ))}
                                    {!safeReport.behavioralQuestions.length && <p className="stat-note" style={{ textAlign: 'center', padding: '1.5rem', fontSize: '0.8rem' }}>No behavioral questions available.</p>}
                                </section>
                            )}

                            {activeTab === "roadmap" && (
                                <section className="roadmap-grid" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                    {safeReport.preparationPlan.map((day, idx) => (
                                        <article className="roadmap-card" key={`r-${idx}`} style={{ background: 'rgba(88, 121, 151, 0.08)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(146, 173, 196, 0.15)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', borderBottom: '1px solid rgba(146, 173, 196, 0.2)', paddingBottom: '0.6rem', marginBottom: '0.6rem' }}>
                                                <span className="material-symbols-outlined" style={{ color: '#6fb2e3', fontSize: '1.2rem' }}>event_available</span>
                                                <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#ffffff' }}>Day {day.day}: {day.focus}</h3>
                                            </div>
                                            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'rgba(234, 243, 251, 0.9)', lineHeight: '1.4', display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.8rem' }}>
                                                {(day.tasks || []).map((task, tIdx) => <li key={tIdx} style={{ paddingLeft: '0.2rem' }}>{task}</li>)}
                                            </ul>
                                        </article>
                                    ))}
                                    {!safeReport.preparationPlan.length && <p className="stat-note" style={{ textAlign: 'center', padding: '1.5rem', fontSize: '0.8rem' }}>No roadmap available.</p>}
                                </section>
                            )}
                        </div>
                    </article>
                </div>

                <footer className="dashboard-footer" style={{ marginTop: '1.5rem', fontSize: '0.75rem' }}>
                    <a href="#" onClick={(e) => e.preventDefault()}>Privacy</a>
                    <a href="#" onClick={(e) => e.preventDefault()}>Terms</a>
                    <a href="#" onClick={(e) => e.preventDefault()}>Support</a>
                </footer>
            </section>
        </main>
    )
}

export default Interview
