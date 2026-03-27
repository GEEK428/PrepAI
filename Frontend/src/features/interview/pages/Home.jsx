import React, { useState, useRef, useEffect } from 'react'
import "../style/home.scss"
import { useInterview } from '../hooks/useInterview.js'
import { useNavigate } from 'react-router'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
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

        try {
            const data = await generateReport({ jobDescription, selfDescription, resumeFile })
            if (!data?._id) {
                setError("Unable to generate report. Please try again.")
                return
            }

            navigate(`/interview/${data._id}`)
        } catch (err) {
            setError(err?.response?.data?.message || "Unable to generate report. Please try again.")
        }
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
                <TopBar />

                <div className="home-content-container">
                    <div className="page-header" style={{ marginBottom: '1.2rem' }}>
                        <p className="kicker">CORE ANALYSIS</p>
                        <p className="subtitle">Sync your career narrative with specific job mandates to generate a tailored preparation path.</p>
                    </div>

                    <article className="analysis-builder">
                        <div className="analysis-builder__main">
                            
                            <div className="input-card left-box">
                                <div className="card-header">
                                    <span className="material-symbols-outlined box-icon">description</span>
                                    <h2>Target Job Description</h2>
                                    <span className="material-symbols-outlined float-icon">work</span>
                                </div>
                                <textarea
                                    className="job-description"
                                    onChange={(e) => setJobDescription(e.target.value)}
                                    placeholder="Paste the full job description here... Our system will extract key requirements, cultural markers, and technical stacks."
                                    value={jobDescription}
                                />
                                <div className="input-footer">
                                    <span>Extracting: Key Skills, Years of Exp, Culture Fit</span>
                                    <span>Min 100 characters recommended</span>
                                </div>
                            </div>
                            
                            <div className="input-card right-box">
                                <div className="card-header">
                                    <span className="material-symbols-outlined box-icon">attachment</span>
                                    <h2>Your Profile</h2>
                                </div>
                                
                                <label className="upload-box">
                                    <span className="material-symbols-outlined">cloud_upload</span>
                                    <strong>Upload Master Resume</strong>
                                    <span>PDF, DOCX up to 10MB</span>
                                    <input 
                                        ref={resumeInputRef} 
                                        type='file' 
                                        accept='.pdf,.docx'
                                        onChange={(e) => setSelectedFile(e.target.files?.[0]?.name || "")}
                                        style={{ display: 'none' }}
                                    />
                                </label>
                                {selectedFile && <div className="file-name">{selectedFile} <button onClick={clearSelectedResume}>✕</button></div>}

                                <div className="or-divider">
                                    <span></span>
                                    <p>OR</p>
                                    <span></span>
                                </div>

                                <div className="self-desc-section">
                                    <h3 className="section-label">
                                        <span className="material-symbols-outlined" style={{color: '#ffb454', fontSize: '1rem'}}>edit_note</span>
                                        QUICK SELF-DESCRIPTION
                                    </h3>
                                    <p className="hint">Add nuance not in your resume... (e.g., career pivots, specific achievements)</p>
                                    <textarea
                                        onChange={(e) => setSelfDescription(e.target.value)}
                                        value={selfDescription}
                                        placeholder=""
                                    />
                                </div>
                            </div>

                        </div>
                        
                        <div className="analysis-builder__footer">
                            {error && <p className="builder-error">{error}</p>}
                            <button
                                onClick={handleGenerateReport}
                                className="generate-btn hero-btn"
                                disabled={loading}
                            >
                                Analyze & Generate Strategy <span className="material-symbols-outlined">bolt</span>
                            </button>
                        </div>
                    </article>
                    
                    <article className="recent-plans-panel">
                        <div className="panel-heading">
                            <div>
                                <h2>My Recent Plans</h2>
                                <p>Review and update your generated prep strategies</p>
                            </div>
                            <button className="view-all-btn" onClick={() => setShowPlansModal(true)}>VIEW ALL HISTORIES</button>
                        </div>
                        
                        {reports.length === 0 ? (
                            <div className="empty-state">
                                <p>No history yet.</p>
                                <span>Generate a report to see it here.</span>
                            </div>
                        ) : (
                            <>
                                <ul className="recent-plans-list">
                                    {reports.slice(0, 4).map(report => {
                                        const dateLabel = new Date(report.createdAt).toLocaleDateString();
                                        return (
                                        <li key={report._id} className="plan-item">
                                            <div className="plan-icon">
                                                <img src="/mind-icon.svg" alt="icon" style={{width: 20}} />
                                            </div>
                                            <div className="plan-meta">
                                                <div className="plan-title-row">
                                                    <h3>{report.title || 'Untitled Position'}</h3>
                                                    {report.matchScore && <span className="match-badge">{report.matchScore}% MATCH</span>}
                                                </div>
                                                <p className="plan-subtitle">Target Role • {dateLabel}</p>
                                            </div>
                                            <div className="readiness-col">
                                                <span className="readiness-label">READINESS</span>
                                                <div className="readiness-bar">
                                                    <div className="bar-fill" style={{width: `${report.matchScore || 50}%`}}></div>
                                                </div>
                                            </div>
                                            <div className="plan-actions">
                                                <button onClick={() => navigate(`/interview/${report._id}`)}><span className="material-symbols-outlined">visibility</span></button>
                                                <button><span className="material-symbols-outlined">ios_share</span></button>
                                            </div>
                                        </li>
                                    )})}
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
