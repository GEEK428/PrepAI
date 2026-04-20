import React, { useState, useRef, useEffect } from 'react'
import "../style/home.scss"
import { useInterview } from '../hooks/useInterview.js'
import { useNavigate } from 'react-router'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import Loader from '../../../components/Loader'

const ResumeAnalysis = () => {

    const { loading, generateReport, reports, getReports } = useInterview()
    
    const [ jobDescription, setJobDescription ] = useState("")
    const [ selfDescription, setSelfDescription ] = useState("")
    const [error, setError] = useState("")
    const [selectedFile, setSelectedFile] = useState("")
    const [showPlansModal, setShowPlansModal] = useState(false)
    const resumeInputRef = useRef()
    const navigate = useNavigate()

    const [modalPage, setModalPage] = useState(1);
    const MODAL_PAGE_SIZE = 10;

    const [historyPage, setHistoryPage] = useState(1);
    const HISTORY_PAGE_SIZE = 4;
    const paginatedReports = reports.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE);
    const totalHistoryPages = Math.ceil(reports.length / HISTORY_PAGE_SIZE);

    useEffect(() => {
        document.title = "Resume Analysis | IntelliPrep"
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

                    <article className="analysis-builder">
                        <div className="analysis-builder__main">
                            
                            <div className="input-card left-box" style={{ padding: '0.8rem' }}>
                                <div className="card-header" style={{ marginBottom: '0.6rem' }}>
                                    <span className="material-symbols-outlined box-icon" style={{ fontSize: '1.2rem' }}>description</span>
                                    <h2 style={{ fontSize: '0.85rem' }}>Target Job Description</h2>
                                </div>
                                <textarea
                                    className="job-description"
                                    onChange={(e) => setJobDescription(e.target.value)}
                                    placeholder="Paste the full job description here..."
                                    value={jobDescription}
                                    style={{ fontSize: '0.8rem', height: '120px' }}
                                />
                            </div>
                            
                            <div className="input-card right-box" style={{ padding: '0.8rem' }}>
                                <div className="card-header" style={{ marginBottom: '0.6rem' }}>
                                    <span className="material-symbols-outlined box-icon" style={{ fontSize: '1.2rem' }}>attachment</span>
                                    <h2 style={{ fontSize: '0.85rem' }}>Your Profile</h2>
                                </div>
                                
                                <label className="upload-box" style={{ padding: '0.8rem', borderStyle: 'dashed' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.5rem' }}>cloud_upload</span>
                                    <strong style={{ fontSize: '0.75rem' }}>Upload Master Resume</strong>
                                    <input 
                                        ref={resumeInputRef} 
                                        type='file' 
                                        accept='.pdf,.docx'
                                        onChange={(e) => setSelectedFile(e.target.files?.[0]?.name || "")}
                                        style={{ display: 'none' }}
                                    />
                                </label>
                                {selectedFile && <div className="file-name" style={{ fontSize: '0.7rem' }}>{selectedFile} <button onClick={clearSelectedResume}>✕</button></div>}

                                <div className="self-desc-section" style={{ marginTop: '0.8rem' }}>
                                    <h3 className="section-label" style={{ fontSize: '0.7rem' }}>QUICK SELF-DESCRIPTION</h3>
                                    <textarea
                                        onChange={(e) => setSelfDescription(e.target.value)}
                                        value={selfDescription}
                                        placeholder="Add pivot details..."
                                        style={{ fontSize: '0.8rem', height: '60px' }}
                                    />
                                </div>
                            </div>

                        </div>
                        
                        <div className="analysis-builder__footer" style={{ marginTop: '0.8rem' }}>
                            {error && <p className="builder-error" style={{ fontSize: '0.7rem', color: '#ffb5af' }}>{error}</p>}
                            <button
                                onClick={handleGenerateReport}
                                className="generate-btn hero-btn"
                                disabled={loading}
                                style={{ padding: '0.6rem 1.2rem', fontSize: '0.8rem' }}
                            >
                                Analyze & Generate Strategy <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>bolt</span>
                            </button>
                        </div>
                    </article>
                    
                    <article className="recent-plans-panel">
                        <div className="panel-heading" style={{ marginBottom: '0.8rem' }}>
                            <div>
                                <h2 style={{ fontSize: '1rem' }}>My Recent Plans</h2>
                            </div>
                            {reports.length > 0 && <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>{reports.length} Total</span>}
                        </div>
                        
                        {reports.length === 0 ? (
                            <div className="empty-state">
                                <p>No history yet.</p>
                            </div>
                        ) : (
                            <div className="inline-pagination-container">
                                <ul className="recent-plans-list" style={{ gap: '0.5rem' }}>
                                    {paginatedReports.map(report => {
                                        const dateLabel = new Date(report.createdAt).toLocaleDateString();
                                        return (
                                        <li key={report._id} className="plan-item" style={{ padding: '0.6rem' }}>
                                            <div className="plan-meta" style={{ flex: 1 }}>
                                                <div className="plan-title-row">
                                                    <h3 style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }} title={report.title}>{report.title || 'Untitled Position'}</h3>
                                                    {report.matchScore && <span className="match-badge" style={{ fontSize: '0.6rem', padding: '2px 4px' }}>{report.matchScore}%</span>}
                                                </div>
                                                <p className="plan-subtitle" style={{ fontSize: '0.65rem' }}>{dateLabel}</p>
                                            </div>
                                            <div className="plan-actions">
                                                <button onClick={() => navigate(`/interview/${report._id}`)} style={{ padding: '4px' }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>visibility</span>
                                                </button>
                                            </div>
                                        </li>
                                    )})}
                                </ul>
                                
                                {totalHistoryPages > 1 && (
                                    <div className="inline-list-pagination" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginTop: '12px' }}>
                                        <button 
                                            disabled={historyPage <= 1} 
                                            onClick={() => setHistoryPage(p => p - 1)}
                                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '2px 10px', borderRadius: '4px', fontSize: '0.7rem', cursor: historyPage <= 1 ? 'not-allowed' : 'pointer' }}
                                        >Prev</button>
                                        <span style={{ fontSize: '0.7rem' }}>{historyPage} of {totalHistoryPages}</span>
                                        <button 
                                            disabled={historyPage >= totalHistoryPages} 
                                            onClick={() => setHistoryPage(p => p + 1)}
                                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '2px 10px', borderRadius: '4px', fontSize: '0.7rem', cursor: historyPage >= totalHistoryPages ? 'not-allowed' : 'pointer' }}
                                        >Next</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </article>
                </div>
                
                <footer className="dashboard-footer">
                    <a href='#' onClick={e => e.preventDefault()}>Privacy Policy</a>
                    <a href='#' onClick={e => e.preventDefault()}>Terms of Service</a>
                    <a href='#' onClick={e => e.preventDefault()}>Help Center</a>
                </footer>
            </section>
        </main>
    )
}

export default ResumeAnalysis
