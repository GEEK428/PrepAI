import React, { useState, useRef, useEffect } from 'react'
import "../style/home.scss"
import { useInterview } from '../hooks/useInterview.js'
import { useNavigate } from 'react-router'
import Sidebar from '../components/Sidebar'
import NotificationBell from '../components/NotificationBell'
import Loader from '../../../components/Loader'

const Home = () => {

    const { loading, generateReport, reports, getReports } = useInterview()
    
    const [ jobDescription, setJobDescription ] = useState("")
    const [ selfDescription, setSelfDescription ] = useState("")
    const [error, setError] = useState("")
    const [selectedFile, setSelectedFile] = useState("")
    const [showPlansModal, setShowPlansModal] = useState(false)
    const resumeInputRef = useRef()

    const navigate = useNavigate()

    useEffect(() => {
        getReports()
    }, [])

    const handleGenerateReport = async () => {
        setError("")
        const resumeFile = resumeInputRef.current?.files?.[0]

        if (!jobDescription?.trim()) {
            setError("Job description is required.")
            return
        }

        if (!resumeFile && !selfDescription?.trim()) {
            setError("Please upload a resume or enter self description.")
            return
        }

        const data = await generateReport({ jobDescription, selfDescription, resumeFile })

        if (!data?._id) {
            setError("Unable to generate report. Please check backend logs and try again.")
            return
        }

        navigate(`/interview/${data._id}`)
    }

    const clearSelectedResume = () => {
        setSelectedFile("")
        if (resumeInputRef.current) {
            resumeInputRef.current.value = ""
        }
    }

    if (loading) {
        return (
            <main className='loading-screen'>
                <Loader message="Analyzing job requirements and your unique profile..." style={{ height: '100vh', background: 'transparent' }} />
            </main>
        )
    }

    return (
        <main className="dashboard-page">
            <Sidebar />
            
            <section className="dashboard-main">
                <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.8rem', color: '#9fd0f4' }}>troubleshoot</span>
                            Resume Analysis
                        </h1>
                        <p className="dashboard-subtitle">Upload your resume or enter a self-description along with the target job listing to generate a personalized interview strategy.</p>
                    </div>
                    <NotificationBell />
                </header>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    <article className="analysis-builder">
                        <div className="panel-heading">
                            <h2>Create Your Custom Interview Strategy</h2>
                        </div>
                        
                        <div className="analysis-builder__main">
                            <div className="input-card">
                                <h2>Target Job Description</h2>
                                <p className="input-card__hint">Paste the full job description here</p>
                                <textarea
                                    className="job-description"
                                    onChange={(e) => setJobDescription(e.target.value)}
                                    placeholder="e.g. 'Senior Frontend Engineer at Google requires proficiency in React, TypeScript, and large-scale system design...'"
                                    value={jobDescription}
                                />
                            </div>
                            
                            <div className="input-card">
                                <h2>Your Profile Background</h2>
                                <p className="input-card__hint">Either upload resume or use self description</p>
                                
                                <label className="file-field">
                                    <span style={{ fontSize: "16px", marginRight: "6px" }}>📄</span>
                                    Select Resume
                                    <input 
                                        ref={resumeInputRef} 
                                        type='file' 
                                        accept='.pdf,.docx'
                                        onChange={(e) => setSelectedFile(e.target.files?.[0]?.name || "")}
                                    />
                                </label>
                                {selectedFile && <div className="file-name">{selectedFile}</div>}
                                {selectedFile && <button className="file-remove-btn" onClick={clearSelectedResume} type="button">Remove</button>}
                                
                                <div style={{ marginTop: "1rem" }}>
                                    <h2 style={{ fontSize: "0.86rem", color: "rgba(194, 214, 233, 0.7)" }}>OR Quick Self-Description</h2>
                                    <textarea
                                        onChange={(e) => setSelfDescription(e.target.value)}
                                        value={selfDescription}
                                        placeholder="Briefly describe your experience, key skills, and years of experience if you don't have a resume handy..."
                                        style={{ minHeight: "65px", marginTop: "0.4rem" }}
                                    />
                                </div>
                            </div>
                        </div>
                        
                        <div className="analysis-builder__footer">
                            <div>
                                {error && <p className="builder-error">{error}</p>}
                            </div>
                                <button
                                    onClick={handleGenerateReport}
                                    className="generate-btn"
                                    disabled={loading}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>auto_awesome</span>
                                    Analyze
                                </button>
                        </div>
                    </article>
                    
                    <article className="reports-panel">
                        <div className="panel-heading">
                            <h2>My Recent Plans</h2>
                        </div>
                        
                        {reports.length === 0 ? (
                            <div className="empty-state">
                                <p>No history yet.</p>
                                <span>Generate a report to see it here.</span>
                            </div>
                        ) : (
                            <>
                                <ul className="report-list">
                                    {reports.slice(0, 4).map(report => (
                                        <li key={report._id} className="report-item">
                                            <div className="report-meta">
                                                <h3>{report.title || 'Untitled Position'}</h3>
                                                <p>{new Date(report.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                            </div>
                                            <p className="report-score">{report.matchScore ? report.matchScore + "% Match" : "Ready"}</p>
                                            <button 
                                                className="download-btn"
                                                onClick={() => navigate(`/interview/${report._id}`)}
                                            >
                                                View Plan
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                                {reports.length > 4 && (
                                    <button 
                                        className="history-more-btn" 
                                        onClick={() => setShowPlansModal(true)}
                                        style={{ marginTop: '0.8rem', width: '100%', display: 'block' }}>
                                        Show More
                                    </button>
                                )}
                            </>
                        )}
                    </article>
                </div>
                
                <footer className="dashboard-footer">
                    <a href='#' onClick={e => e.preventDefault()}>Privacy Policy</a>
                    <a href='#' onClick={e => e.preventDefault()}>Terms of Service</a>
                    <a href='#' onClick={e => e.preventDefault()}>Help Center</a>
                </footer>
            </section>
            
            {showPlansModal && (
                <section className="history-modal-overlay" onClick={() => setShowPlansModal(false)}>
                    <article className="history-modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(760px, 92vw)', maxHeight: '78vh', overflow: 'auto', border: '1px solid rgba(146, 173, 196, 0.24)', borderRadius: '0.85rem', background: 'linear-gradient(145deg, rgba(24, 40, 56, 0.96), rgba(10, 18, 27, 0.98))', padding: '1.2rem' }}>
                        <div className="history-modal__head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>All Report Plans</h3>
                            <div className="history-modal__actions">
                                <button type="button" onClick={() => setShowPlansModal(false)}>Close</button>
                            </div>
                        </div>
                        <div className="history-modal__list" style={{ display: 'grid', gap: '0.6rem' }}>
                            {reports.map(report => (
                                <div className="history-modal__item" key={report._id} style={{ border: '1px solid rgba(146, 173, 196, 0.22)', background: 'rgba(88, 121, 151, 0.1)', borderRadius: '0.55rem', padding: '0.62rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <strong style={{ fontSize: '0.86rem' }}>{report.title || 'Untitled Position'}</strong>
                                        <p style={{ margin: '0.14rem 0 0', fontSize: '0.74rem', color: 'rgba(194, 214, 233, 0.72)' }}>{new Date(report.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                        <p className="report-score" style={{ margin: 0 }}>{report.matchScore ? report.matchScore + "% Match" : "Ready"}</p>
                                        <button 
                                            type="button" 
                                            onClick={() => navigate(`/interview/${report._id}`)}
                                            style={{ border: '1px solid rgba(143, 180, 210, 0.3)', background: 'rgba(97, 137, 169, 0.2)', color: '#eaf3fb', borderRadius: '0.35rem', padding: '0.28rem 0.55rem', fontSize: '0.72rem', cursor: 'pointer' }}>
                                            View Plan
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </article>
                </section>
            )}
        </main>
    )
}

export default Home
