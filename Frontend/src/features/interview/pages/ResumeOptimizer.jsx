import React, { useEffect, useRef, useState } from "react"
import "../style/home.scss"
import "../style/resume-builder.scss"
import { useInterview } from "../hooks/useInterview"
import Sidebar from "../components/Sidebar"
import TopBar from "../components/TopBar"

const DOWNLOAD_HISTORY_KEY = "intelliprep_resume_download_history"

const ResumeOptimizer = () => {
    const { loading, generateReport, getResumePdfBlob } = useInterview()
    const fileInputRef = useRef(null)

    const [jobDescription, setJobDescription] = useState("")
    const [selectedFile, setSelectedFile] = useState("")
    const [error, setError] = useState("")
    const [latestReportId, setLatestReportId] = useState("")
    const [latestFileName, setLatestFileName] = useState("")
    const [previewUrl, setPreviewUrl] = useState("")
    const [history, setHistory] = useState([])
    const [showAllHistory, setShowAllHistory] = useState(false)
    const [zoom, setZoom] = useState(100)

    const formatDateTime = (value) => new Date(value).toLocaleString()

    useEffect(() => {
        document.title = "Resume Optimizer | IntelliPrep"
        const stored = localStorage.getItem(DOWNLOAD_HISTORY_KEY)
        if (stored) {
            try {
                const parsed = JSON.parse(stored)
                if (Array.isArray(parsed)) setHistory(parsed)
            } catch (err) { console.log(err) }
        }
    }, [])

    useEffect(() => {
        return () => {
            if (previewUrl) window.URL.revokeObjectURL(previewUrl)
        }
    }, [previewUrl])

    const persistHistory = (entries) => {
        setHistory(entries)
        localStorage.setItem(DOWNLOAD_HISTORY_KEY, JSON.stringify(entries))
    }

    const clearHistory = () => persistHistory([])

    const removeHistoryItem = (target) => {
        const next = history.filter((item) => !(item.reportId === target.reportId && item.createdAt === target.createdAt))
        persistHistory(next)
    }

    const openBlobInNewTab = (url) => {
        window.open(url, "_blank", "noopener,noreferrer")
    }

    const triggerDownload = async ({ reportId, fileName }) => {
        if (!reportId) return
        try {
            const blob = await getResumePdfBlob(reportId)
            if (!blob) return
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = url
            link.setAttribute("download", fileName || `resume_${reportId}.pdf`)
            document.body.appendChild(link)
            link.click()
            link.remove()
            setTimeout(() => window.URL.revokeObjectURL(url), 2500)
        } catch (e) { console.error(e) }
    }

    const handleGenerateOptimizedResume = async () => {
        setError("")
        const resumeFile = fileInputRef.current?.files?.[0]
        if (!jobDescription.trim()) return setError("Job description is required.")
        if (!resumeFile) return setError("Upload a resume file to continue.")

        try {
            const generated = await generateReport({
                jobDescription: jobDescription.trim(),
                selfDescription: "",
                resumeFile
            })

            if (!generated?._id) throw new Error("Generation failed.")

            const blob = await getResumePdfBlob(generated._id)
            if (!blob) throw new Error("PDF generation failed.")

            const url = window.URL.createObjectURL(blob)
            setPreviewUrl((prev) => {
                if (prev) window.URL.revokeObjectURL(prev)
                return url
            })
            setLatestReportId(generated._id)

            const fileName = `optimized_resume_${Date.now()}.pdf`
            setLatestFileName(fileName)
            const nextHistory = [
                { reportId: generated._id, fileName, createdAt: new Date().toISOString() },
                ...history.filter((item) => item.reportId !== generated._id)
            ]
            persistHistory(nextHistory)
        } catch (err) {
            setError(err?.response?.data?.message || "AI failed to optimize. Please try again.")
        }
    }

    return (
        <main className="dashboard-page">
            <Sidebar />

            <section className="dashboard-main resume-builder-main">
                <TopBar />
                <div className="page-header compact-header" style={{ marginBottom: '1rem' }}>
                    <p className="kicker">CAREER TOOLS</p>
                    <h1>RESUME OPTIMIZER</h1>
                </div>

                <section className="builder-grid">
                    <article className="upload-panel card-glass">
                        <div className="compact-upload">
                            <button className="select-btn" onClick={() => fileInputRef.current?.click()}>
                                <span className="material-symbols-outlined">upload_file</span>
                                {selectedFile ? selectedFile : "Upload Resume (PDF/DOCX)"}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.doc,.docx"
                                onChange={(e) => setSelectedFile(e.target.files?.[0]?.name || "")}
                                style={{ display: 'none' }}
                            />
                        </div>

                        <div className="job-desc-wrap">
                            <label>TARGET JOB DESCRIPTION</label>
                            <textarea
                                placeholder="Paste the job requirements here..."
                                value={jobDescription}
                                onChange={(e) => setJobDescription(e.target.value)}
                            />
                        </div>

                        {error && <p className="builder-error">{error}</p>}
                        
                        <button className="generate-btn-main" onClick={handleGenerateOptimizedResume} disabled={loading}>
                            <span className="material-symbols-outlined">auto_awesome</span>
                            {loading ? "GENERATING..." : "GENERATE TAILORED RESUME"}
                        </button>

                        <div className="mini-history">
                            <h3>RECENT BUILDS</h3>
                            <div className="history-list-compact">
                                {history.slice(0, 3).map((item) => (
                                    <div key={item.reportId} className="history-pill">
                                        <span>{item.fileName}</span>
                                        <button onClick={() => triggerDownload({ reportId: item.reportId, fileName: item.fileName })}>
                                            <span className="material-symbols-outlined">download</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </article>

                    <article className="preview-panel card-glass">
                        <div className="preview-top">
                            <div className="preview-meta">
                                <h3>RESUME PREVIEW</h3>
                                <p>1:1 Industry Standard Format</p>
                            </div>
                            {previewUrl && (
                                <div className="preview-controls">
                                    <button onClick={() => setZoom(prev => Math.max(50, prev - 10))}>-</button>
                                    <span>{zoom}%</span>
                                    <button onClick={() => setZoom(prev => Math.min(150, prev + 10))}>+</button>
                                </div>
                            )}
                        </div>

                        <div className="preview-scroll-area">
                            {previewUrl ? (
                                <div className="iframe-container" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}>
                                    <iframe src={previewUrl} className="resume-iframe" title="preview" />
                                </div>
                            ) : (
                                <div className="preview-empty">
                                    <span className="material-symbols-outlined">description</span>
                                    <p>Optimized resume will appear here</p>
                                </div>
                            )}
                        </div>

                        <div className="preview-footer-actions">
                            <button className="action-btn secondary" disabled={!previewUrl} onClick={() => openBlobInNewTab(previewUrl)}>
                                <span className="material-symbols-outlined">open_in_new</span> FULL VIEW
                            </button>
                            <button className="action-btn secondary" disabled={!previewUrl}>
                                <span className="material-symbols-outlined">add_to_drive</span> SAVE TO DRIVE
                            </button>
                            <button className="action-btn primary" disabled={!latestReportId} 
                                onClick={() => triggerDownload({ reportId: latestReportId, fileName: latestFileName })}>
                                <span className="material-symbols-outlined">download</span> DOWNLOAD PDF
                            </button>
                        </div>
                    </article>
                </section>
            </section>
        </main>
    )
}

export default ResumeOptimizer
