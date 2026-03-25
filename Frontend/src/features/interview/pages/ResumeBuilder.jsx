import React, { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router"
import "../style/home.scss"
import "../style/resume-builder.scss"
import { useInterview } from "../hooks/useInterview"
import Sidebar from "../components/Sidebar"
import NotificationBell from "../components/NotificationBell"

const DOWNLOAD_HISTORY_KEY = "intelliprep_resume_download_history"

const ResumeBuilder = () => {
    const navigate = useNavigate()
    const { loading, generateReport, getResumePdfBlob } = useInterview()
    const fileInputRef = useRef(null)

    const [jobDescription, setJobDescription] = useState("")
    const [selfDescription, setSelfDescription] = useState("")
    const [selectedFile, setSelectedFile] = useState("")
    const [error, setError] = useState("")
    const [latestReportId, setLatestReportId] = useState("")
    const [previewUrl, setPreviewUrl] = useState("")
    const [history, setHistory] = useState([])
    const [showAllHistory, setShowAllHistory] = useState(false)

    const formatDateTime = (value) => new Date(value).toLocaleString()

    useEffect(() => {
        document.title = "Resume Builder | IntelliPrep"
        const stored = localStorage.getItem(DOWNLOAD_HISTORY_KEY)
        if (stored) {
            try {
                const parsed = JSON.parse(stored)
                if (Array.isArray(parsed)) {
                    setHistory(parsed)
                }
            } catch (err) {
                console.log(err)
            }
        }
    }, [])

    const persistHistory = (entries) => {
        setHistory(entries)
        localStorage.setItem(DOWNLOAD_HISTORY_KEY, JSON.stringify(entries))
    }

    const clearHistory = () => {
        persistHistory([])
    }

    const removeHistoryItem = (target) => {
        const next = history.filter((item) => !(item.reportId === target.reportId && item.createdAt === target.createdAt))
        persistHistory(next)
    }

    const triggerDownload = async ({ reportId, fileName }) => {
        if (!reportId) return
        
        // Open a blank tab immediately to bypass mobile popup blockers (needs a direct user click)
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
        let downloadWindow = null;
        if (isMobile) {
            downloadWindow = window.open('about:blank', '_blank');
        }

        try {
            const blob = await getResumePdfBlob(reportId)
            if (!blob) {
                if (downloadWindow) downloadWindow.close();
                return
            }
            const url = window.URL.createObjectURL(blob)
            
            if (isMobile && downloadWindow) {
                // Redirect the already-open tab to the PDF blob
                downloadWindow.location.href = url;
            } else {
                const link = document.createElement("a")
                link.href = url
                link.setAttribute("download", fileName)
                document.body.appendChild(link)
                link.click()
                link.remove()
                // Revoke after small delay to ensure click finishes
                setTimeout(() => window.URL.revokeObjectURL(url), 1000)
            }
        } catch (e) {
            if (downloadWindow) downloadWindow.close();
            console.error(e);
        }
    }

    const handleGenerateOptimizedResume = async () => {
        setError("")

        const resumeFile = fileInputRef.current?.files?.[0]
        if (!jobDescription.trim()) {
            setError("Job description is required.")
            return
        }
        if (!resumeFile && !selfDescription.trim()) {
            setError("Upload a resume or add self description.")
            return
        }

        const generated = await generateReport({
            jobDescription: jobDescription.trim(),
            selfDescription: selfDescription.trim(),
            resumeFile
        })

        if (!generated?._id) {
            setError("Unable to generate optimized resume. Please try again.")
            return
        }

        const blob = await getResumePdfBlob(generated._id)
        if (!blob) {
            setError("Resume generation failed. Please try again.")
            return
        }

        const url = window.URL.createObjectURL(blob)
        setPreviewUrl((prev) => {
            if (prev) window.URL.revokeObjectURL(prev)
            return url
        })
        setLatestReportId(generated._id)

        const fileName = `resume_${(generated.title || "optimized").replace(/\s+/g, "_").toLowerCase()}.pdf`
        const nextHistory = [
            {
                reportId: generated._id,
                fileName,
                createdAt: new Date().toISOString()
            },
            ...history.filter((item) => item.reportId !== generated._id)
        ]
        persistHistory(nextHistory)
    }

    const clearSelectedResume = () => {
        setSelectedFile("")
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    return (
        <main className="dashboard-page">
            <Sidebar />

            <section className="dashboard-main resume-builder-main">
                <header className="dashboard-header">
                    <div>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.8rem', color: '#9fd0f4' }}>edit_document</span>
                            Resume Builder
                        </h1>
                        <p className="dashboard-subtitle">Provide your resume or self-description with a job listing to generate a tailored, optimized resume PDF.</p>
                    </div>
                    <NotificationBell />
                </header>

                <section className="builder-grid">
                    <article className="upload-panel">
                        <div className="upload-drop">
                            <div className="upload-icon">UP</div>
                            <h3>Resume Source</h3>
                            <p>Upload resume or use self description with job description.</p>
                            <button type="button" onClick={() => fileInputRef.current?.click()}>Select File</button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.doc,.docx"
                                onChange={(e) => setSelectedFile(e.target.files?.[0]?.name || "")}
                            />
                            {selectedFile && <span className="selected-file">{selectedFile}</span>}
                            {selectedFile && (
                                <button type="button" className="file-remove-btn" onClick={clearSelectedResume}>X</button>
                            )}
                        </div>

                        <div className="builder-inputs">
                            <textarea
                                placeholder="Self description (optional if resume uploaded)"
                                value={selfDescription}
                                onChange={(e) => setSelfDescription(e.target.value)}
                            />
                            <textarea
                                placeholder="Job description (required)"
                                value={jobDescription}
                                onChange={(e) => setJobDescription(e.target.value)}
                            />
                            {error && <p className="builder-error">{error}</p>}
                            <button type="button" onClick={handleGenerateOptimizedResume} disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>auto_awesome</span>
                                {loading ? "Generating..." : "Generate Optimized Resume"}
                            </button>
                        </div>

                        <div className="download-history">
                            <div className="history-top">
                                <h4>Download History</h4>
                            </div>
                            <ul>
                                {history.slice(0, 3).map((item) => (
                                    <li key={`${item.reportId}-${item.createdAt}`}>
                                        <div>
                                            <strong>{item.fileName}</strong>
                                            <small>{formatDateTime(item.createdAt)}</small>
                                        </div>
                                        <div className="history-item-actions">
                                            <button type="button" title="Download Resume" aria-label="Download" onClick={() => triggerDownload({ reportId: item.reportId, fileName: item.fileName })} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.35rem 0.5rem' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>cloud_download</span>
                                            </button>
                                            <button type="button" title="Delete Resume" aria-label="Delete" className="history-delete-btn" onClick={() => removeHistoryItem(item)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.35rem 0.5rem' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>delete</span>
                                            </button>
                                        </div>
                                    </li>
                                ))}
                                {!history.length && <li><small>No downloaded PDFs yet.</small></li>}
                            </ul>
                            {history.length > 3 && (
                                <button type="button" className="history-more-btn" onClick={() => setShowAllHistory(true)}>Show More</button>
                            )}
                        </div>
                    </article>

                    <article className="preview-panel">
                        <div className="preview-head">
                            <p>Live Parser Preview</p>
                            <span>{previewUrl ? "Parsed" : "Waiting"}</span>
                        </div>

                        <div className="preview-body">
                            {previewUrl ? (
                                <>
                                    <iframe title="resume-preview" src={previewUrl} className="preview-iframe-desktop" />
                                    <div className="preview-mobile-fallback">
                                        <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: '#9fd0f4' }}>picture_as_pdf</span>
                                        <p>Your resume PDF is ready!</p>
                                        <button type="button" onClick={() => window.open(previewUrl, '_blank')}>
                                            Open PDF Preview
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="preview-placeholder">Generated resume preview will appear here.</div>
                            )}
                        </div>

                        <div className="preview-actions">
                            <button
                                type="button"
                                disabled={!latestReportId}
                                onClick={() => latestReportId && triggerDownload({ reportId: latestReportId, fileName: `resume_${latestReportId}.pdf` })}
                            >
                                Download
                            </button>
                        </div>
                    </article>
                </section>

                <footer className="dashboard-footer">
                    <a href="#" onClick={(e) => e.preventDefault()}>Privacy</a>
                    <a href="#" onClick={(e) => e.preventDefault()}>Terms</a>
                    <a href="#" onClick={(e) => e.preventDefault()}>Support</a>
                </footer>
            </section>

            {showAllHistory && (
                <section className="history-modal-overlay" onClick={() => setShowAllHistory(false)}>
                    <article className="history-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="history-modal__head">
                            <h3>All Downloaded PDFs</h3>
                            <div className="history-modal__actions">
                                <button type="button" onClick={clearHistory}>Clear History</button>
                                <button type="button" onClick={() => setShowAllHistory(false)}>Close</button>
                            </div>
                        </div>
                        <div className="history-modal__list">
                            {history.map((item) => (
                                <div className="history-modal__item" key={`${item.reportId}-${item.createdAt}`}>
                                    <div>
                                        <strong>{item.fileName}</strong>
                                        <p>{formatDateTime(item.createdAt)}</p>
                                    </div>
                                    <div className="history-modal__actions">
                                        <button type="button" title="Download" onClick={() => triggerDownload({ reportId: item.reportId, fileName: item.fileName })} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.4rem 0.6rem' }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>cloud_download</span>
                                        </button>
                                        <button type="button" title="Delete" onClick={() => removeHistoryItem(item)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.4rem 0.6rem' }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>delete</span>
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

export default ResumeBuilder
