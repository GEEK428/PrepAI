import React, { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router"
import "../style/home.scss"
import "../style/notes.scss"
import { createNote, deleteNote, exportNotesPdf, generateAiAnswer, getNotes, updateNote } from "../services/notes.api"
import Sidebar from "../components/Sidebar"
import NotificationBell from "../components/NotificationBell"

const COMMON_SUBDOMAINS = [
    "None",
    "DSA",
    "Core Domain",
    "Developement",
    "Cybersecurity",
    "AI",
    "ML",
    "Data Science",
    "System Design",
    "Cloud/Devops"
]

const DOMAIN_MAP = {
    Technical: COMMON_SUBDOMAINS,
    Behavioral: COMMON_SUBDOMAINS,
    "Role Specific": COMMON_SUBDOMAINS
}

const TOOLBAR_ACTIONS = [
    { label: "B", command: "bold" },
    { label: "I", command: "italic" },
    { label: "U", command: "underline" },
    { label: "S", command: "strikeThrough" },
    { label: "UL", command: "insertUnorderedList" },
    { label: "OL", command: "insertOrderedList" }
]

const statusLabel = (status) => {
    if (status === "done") return "Understood"
    if (status === "needs_revision") return "Needs Revision"
    return "Understood"
}

const Notes = () => {
    const navigate = useNavigate()
    const editorRef = useRef(null)

    const [notes, setNotes] = useState([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState("")
    const [selectedIds, setSelectedIds] = useState([])
    const [activeId, setActiveId] = useState("")
    const [message, setMessage] = useState("")
    const [error, setError] = useState("")
    const [isDirty, setIsDirty] = useState(false)
    const [aiLoading, setAiLoading] = useState(false)
    const [saveLoading, setSaveLoading] = useState(false)
    const [isCreatingNew, setIsCreatingNew] = useState(true)
    const [filterDomain, setFilterDomain] = useState("all")
    const [filterSubdomain, setFilterSubdomain] = useState("all")
    const [filterDifficulty, setFilterDifficulty] = useState("all")
    const [filterUnderstanding, setFilterUnderstanding] = useState("all")
    const [filterConfidence, setFilterConfidence] = useState("all")
    const [filterBookmarked, setFilterBookmarked] = useState("all")
    const [showAllNotes, setShowAllNotes] = useState(false)
    const [showFilterOptions, setShowFilterOptions] = useState(false)
    const [showChooseOptions, setShowChooseOptions] = useState(false)

    const [domain, setDomain] = useState("Technical")
    const [subdomain, setSubdomain] = useState("DSA")
    const [question, setQuestion] = useState("")
    const [answer, setAnswer] = useState("")
    const [difficulty, setDifficulty] = useState("medium")
    const [status, setStatus] = useState("done")
    const [bookmarked, setBookmarked] = useState(false)
    const [sourceTag, setSourceTag] = useState("")
    const [confidence, setConfidence] = useState(3)

    const activeNote = useMemo(() => notes.find((item) => item._id === activeId) || null, [ notes, activeId ])
    const aiLimitMessage = useMemo(() => {
        const msg = String(error || "")
        if (msg.toLowerCase().includes("you have reached limit")) {
            return msg
        }
        return ""
    }, [ error ])
    const displayedNotes = useMemo(() => {
        const q = search.trim().toLowerCase()
        return notes.filter((note) => {
            if (filterDomain !== "all" && note.domain !== filterDomain) return false
            if (filterSubdomain !== "all" && note.subdomain !== filterSubdomain) return false
            if (filterDifficulty !== "all" && note.difficulty !== filterDifficulty) return false
            if (filterUnderstanding === "understood" && note.status !== "done") return false
            if (filterUnderstanding === "needs_revision" && note.status !== "needs_revision") return false
            if (filterBookmarked === "yes" && !note.bookmarked) return false
            if (filterBookmarked === "no" && note.bookmarked) return false
            if (filterConfidence !== "all" && Number(note.confidence || 3) !== Number(filterConfidence)) return false
            if (!q) return true
            const haystack = [
                note.question,
                note.answer,
                note.domain,
                note.subdomain,
                note.sourceTag
            ].join(" ").toLowerCase()
            return haystack.includes(q)
        })
    }, [ notes, filterDomain, filterSubdomain, filterDifficulty, filterUnderstanding, filterBookmarked, filterConfidence, search ])
    const previewNotes = useMemo(() => displayedNotes.slice(0, 3), [ displayedNotes ])

    const stats = useMemo(() => {
        const understood = notes.filter((item) => item.status === "done").length
        const needsRevision = notes.filter((item) => item.status === "needs_revision").length
        const generated = notes.length
        const successRate = generated ? Math.round((understood / generated) * 100) : 0
        const bookmarkedCount = notes.filter((item) => Boolean(item.bookmarked)).length
        const averageConfidence = generated
            ? (notes.reduce((acc, item) => acc + Number(item.confidence || 3), 0) / generated).toFixed(1)
            : "0.0"
        const visibleAfterFilter = displayedNotes.length
        return { understood, needsRevision, successRate, generated, bookmarkedCount, averageConfidence, visibleAfterFilter }
    }, [ notes, displayedNotes ])

    const chart = useMemo(() => {
        const total = Math.max(1, stats.generated)
        const understoodDeg = (stats.understood / total) * 360
        const revisionDeg = (stats.needsRevision / total) * 360
        const understoodPct = Math.round((stats.understood / total) * 100)
        const revisionPct = Math.round((stats.needsRevision / total) * 100)
        return {
            style: {
                background: `conic-gradient(
                    #67d7ac 0deg ${understoodDeg}deg,
                    #ffb9b3 ${understoodDeg}deg ${understoodDeg + revisionDeg}deg,
                    rgba(142, 201, 244, 0.3) ${understoodDeg + revisionDeg}deg 360deg
                )`
            },
            understoodPct,
            revisionPct
        }
    }, [ stats ])

    useEffect(() => {
        document.title = "Notes / Prep Space | IntelliPrep"
    }, [])

    useEffect(() => {
        const firstSubdomain = DOMAIN_MAP[domain]?.[0] || ""
        setSubdomain(firstSubdomain)
    }, [ domain ])

    useEffect(() => {
        setFilterSubdomain("all")
    }, [ filterDomain ])

    const loadNotes = async () => {
        setLoading(true)
        setError("")
        try {
            const response = await getNotes({
                view: "all"
            })
            const fetched = response?.notes || []
            setNotes(fetched)
            if (activeId && !fetched.some((note) => note._id === activeId)) {
                setActiveId("")
                setIsCreatingNew(true)
            }
        } catch (err) {
            setError(err?.response?.data?.message || "Unable to load notes.")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadNotes()
    }, [])

    useEffect(() => {
        if (!activeNote) return
        setIsCreatingNew(false)
        setDomain(activeNote.domain || "Technical")
        setSubdomain(activeNote.subdomain || "DSA")
        setQuestion(activeNote.question || "")
        setAnswer(activeNote.answer || "")
        setDifficulty(activeNote.difficulty || "medium")
        setStatus(activeNote.status === "needs_revision" ? "needs_revision" : "done")
        setBookmarked(Boolean(activeNote.bookmarked))
        setSourceTag(activeNote.sourceTag || "")
        setConfidence(activeNote.confidence || 3)
        if (editorRef.current) {
            editorRef.current.innerHTML = activeNote.answerHtml || activeNote.answer || ""
        }
        setIsDirty(false)
    }, [ activeNote ])

    useEffect(() => {
        if (!activeId || !isDirty) return
        const timer = setInterval(() => {
            handleSaveNote({ silent: true })
        }, 30000)
        return () => clearInterval(timer)
    }, [ activeId, isDirty, domain, subdomain, question, answer, difficulty, status, bookmarked, sourceTag, confidence ])



    const resetForm = () => {
        setIsCreatingNew(true)
        setActiveId("")
        setDomain("Technical")
        setSubdomain("DSA")
        setQuestion("")
        setAnswer("")
        setDifficulty("medium")
        setStatus("done")
        setBookmarked(false)
        setSourceTag("")
        setConfidence(3)
        if (editorRef.current) {
            editorRef.current.innerHTML = ""
        }
        setIsDirty(false)
    }

    const handleSaveNote = async ({ silent = false } = {}) => {
        if (!question.trim()) {
            if (!silent) setError("Question is required.")
            return
        }

        setSaveLoading(true)
        if (!silent) {
            setError("")
            setMessage("")
        }

        const payload = {
            domain,
            subdomain,
            question: question.trim(),
            answer: answer.trim(),
            answerHtml: editorRef.current?.innerHTML || "",
            difficulty,
            status,
            bookmarked,
            sourceTag,
            confidence
        }

        try {
            if (isCreatingNew || !activeId) {
                const response = await createNote(payload)
                const created = response?.note
                if (!created) return
                setNotes((prev) => [ created, ...prev ])
                if (!silent) {
                    setMessage("Question saved to Question Bank.")
                }
                setActiveId("")
                setIsCreatingNew(true)
                setQuestion("")
                setAnswer("")
                setSourceTag("")
                setBookmarked(false)
                setConfidence(3)
                setStatus("done")
                if (editorRef.current) {
                    editorRef.current.innerHTML = ""
                }
            } else {
                const response = await updateNote(activeId, payload)
                const updated = response?.note
                if (!updated) return
                setNotes((prev) => prev.map((item) => item._id === updated._id ? updated : item))
                if (!silent) setMessage("Changes saved.")
            }
            setIsDirty(false)
        } catch (err) {
            if (!silent) setError(err?.response?.data?.message || "Unable to save note.")
        } finally {
            setSaveLoading(false)
        }
    }

    const handleDelete = async (noteId) => {
        try {
            await deleteNote(noteId)
            setNotes((prev) => prev.filter((item) => item._id !== noteId))
            setSelectedIds((prev) => prev.filter((id) => id !== noteId))
            if (activeId === noteId) {
                resetForm()
            }
        } catch (err) {
            setError(err?.response?.data?.message || "Unable to delete note.")
        }
    }

    const toggleSelect = (noteId) => {
        setSelectedIds((prev) => prev.includes(noteId)
            ? prev.filter((id) => id !== noteId)
            : [ ...prev, noteId ])
    }

    const handleExportSelected = async () => {
        try {
            const blob = await exportNotesPdf(selectedIds)
            const url = window.URL.createObjectURL(new Blob([ blob ], { type: "application/pdf" }))
            const link = document.createElement("a")
            link.href = url
            link.setAttribute("download", "intelliprep_notes.pdf")
            document.body.appendChild(link)
            link.click()
            window.URL.revokeObjectURL(url)
            setMessage("PDF downloaded.")
        } catch (err) {
            setError(err?.response?.data?.message || "Unable to export notes.")
        }
    }

    const handleGenerateAiAnswer = async () => {
        setMessage("")
        setError("")
        if (!question.trim()) {
            setError("Add a question first to generate AI answer.")
            return
        }

        setAiLoading(true)
        try {
            const response = await generateAiAnswer({
                domain,
                subdomain,
                question: question.trim(),
                sourceTag,
                difficulty
            })
            const aiAnswer = response?.aiAnswer
            if (!aiAnswer) {
                setError("AI answer generation failed.")
                return
            }

            const html = aiAnswer.answerHtml || `<p>${String(aiAnswer.answerText || "").replace(/\n/g, "<br/>")}</p>`
            if (editorRef.current) {
                editorRef.current.innerHTML = html
            }
            setAnswer(aiAnswer.answerText || editorRef.current?.innerText || "")
            setIsDirty(true)
            setMessage("AI answer inserted. Click Save.")
        } catch (err) {
            setError(err?.response?.data?.message || "Unable to generate AI answer.")
        } finally {
            setAiLoading(false)
        }
    }

    const exec = (command, value = null) => {
        document.execCommand(command, false, value)
        setAnswer(editorRef.current?.innerText || "")
        setIsDirty(true)
    }

    const setTextColor = (color) => exec("foreColor", color)
    const setHighlight = () => {
        exec("hiliteColor", "#fff8c9")
        exec("foreColor", "#0e1a25")
    }
    const setDefaultTextColor = () => exec("foreColor", "#eaf2f8")
    const clearHighlight = () => {
        exec("hiliteColor", "transparent")
        exec("foreColor", "#eaf2f8")
    }

    const subdomains = DOMAIN_MAP[domain] || []
    const filterSubdomainOptions = useMemo(() => {
        if (filterDomain === "all") {
            return COMMON_SUBDOMAINS
        }
        return DOMAIN_MAP[filterDomain] || []
    }, [ filterDomain ])

    return (
        <main className="dashboard-page">
            <Sidebar />

            <section className="dashboard-main notes-main">
                <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.8rem', color: '#9fd0f4' }}>menu_book</span>
                            Notes / Prep Space
                        </h1>
                        <p className="dashboard-subtitle">Create, organize, and review interview questions with answers — filter by domain, difficulty, and confidence.</p>
                    </div>
                    <NotificationBell />
                </header>

                <div className="notes-search-row">
                    <div className="notes-search-wrap">
                        <span className="notes-search-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none">
                                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                                <path d="M20 20L16.7 16.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </span>
                        <input
                            className="notes-search"
                            placeholder="Search by keyword in question, answer, source..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="notes-layout">
                    <article className="notes-panel notes-list-panel">
                        <div className="notes-panel__head">
                            <h3>Question Bank</h3>
                            <div className="notes-panel__actions">
                                <button type="button" onClick={() => setShowFilterOptions((prev) => !prev)}>
                                    {showFilterOptions ? "Hide Filters" : "Filter Options"}
                                </button>
                                <button type="button" className="generate-btn compact" onClick={resetForm} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>add</span>
                                    New Question
                                </button>
                            </div>
                        </div>

                            {showFilterOptions && (
                                <div className="notes-filters">
                                <label className="filter-field">
                                    Domain Specific
                                    <select value={filterDomain} onChange={(e) => setFilterDomain(e.target.value)}>
                                        <option value="all">All</option>
                                        <option value="Technical">Technical</option>
                                        <option value="Behavioral">Behavioral</option>
                                        <option value="Role Specific">Role Based</option>
                                    </select>
                                </label>
                                <label className="filter-field">
                                    Sub Domain
                                    <select value={filterSubdomain} onChange={(e) => setFilterSubdomain(e.target.value)}>
                                        <option value="all">All</option>
                                        {filterSubdomainOptions.map((name) => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="filter-field">
                                    Difficulty
                                    <select value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)}>
                                        <option value="all">All</option>
                                        <option value="easy">Easy</option>
                                        <option value="medium">Medium</option>
                                        <option value="hard">Hard</option>
                                    </select>
                                </label>
                                <label className="filter-field">
                                    Understanding Level
                                    <select value={filterUnderstanding} onChange={(e) => setFilterUnderstanding(e.target.value)}>
                                        <option value="all">All</option>
                                        <option value="understood">Understood</option>
                                        <option value="needs_revision">Needs Revision</option>
                                    </select>
                                </label>
                                <label className="filter-field">
                                    Confidence Level
                                    <select value={filterConfidence} onChange={(e) => setFilterConfidence(e.target.value)}>
                                        <option value="all">All</option>
                                        <option value="1">1</option>
                                        <option value="2">2</option>
                                        <option value="3">3</option>
                                        <option value="4">4</option>
                                        <option value="5">5</option>
                                    </select>
                                </label>
                                <label className="filter-field">
                                    Bookmarked
                                    <select value={filterBookmarked} onChange={(e) => setFilterBookmarked(e.target.value)}>
                                        <option value="all">All</option>
                                        <option value="yes">Yes</option>
                                        <option value="no">No</option>
                                    </select>
                                </label>
                                </div>
                            )}

                        {loading && <p className="notes-meta">Loading...</p>}

                        {!loading && (
                            <div className="notes-list">
                                {previewNotes.map((note) => (
                                    <article
                                        key={note._id}
                                        className={`note-list-item ${activeId === note._id ? "active" : ""}`}
                                        onClick={() => {
                                            setActiveId(note._id)
                                            setIsCreatingNew(false)
                                        }}
                                    >
                                        <div className="note-list-item__top">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(note._id)}
                                                onChange={(e) => {
                                                    e.stopPropagation()
                                                    toggleSelect(note._id)
                                                }}
                                            />
                                            <strong>{note.question}</strong>
                                        </div>
                                        <p>{note.subdomain}</p>
                                        <div className="note-list-item__meta">
                                            {note.sourceTag && (
                                                <span className="tag-pill tag-source">
                                                    <span className="tag-icon">I</span>{note.sourceTag}
                                                </span>
                                            )}
                                            <span className="tag-pill tag-status">
                                                <span className="tag-icon">S</span>{statusLabel(note.status)}
                                            </span>
                                            <span className="tag-pill tag-diff">
                                                <span className="tag-icon">D</span>{note.difficulty}
                                            </span>
                                            <span className="tag-pill tag-confidence">
                                                <span className="tag-icon">C</span>{Number(note.confidence || 3)}
                                            </span>
                                            {note.bookmarked && (
                                                <span className="tag-pill tag-bookmark">
                                                    <span className="tag-icon">*</span>
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleDelete(note._id)
                                                }}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </article>
                                ))}
                                {!previewNotes.length && <p className="notes-meta">No questions in this section.</p>}
                            </div>
                        )}
                        {!loading && displayedNotes.length > 3 && (
                            <button type="button" className="history-more-btn" onClick={() => setShowAllNotes(true)}>
                                Show More
                            </button>
                        )}
                        {!loading && (
                            <button type="button" className="generate-btn compact notes-export-bottom" onClick={handleExportSelected}>
                                Export Selected PDF
                            </button>
                        )}
                    </article>

                    <article className="notes-panel notes-editor-panel">
                        <div className="notes-panel__head">
                            <h3>{isCreatingNew ? "Create Question" : "Edit Question"}</h3>
                            <div className="notes-panel__actions">
                                <button type="button" onClick={() => handleSaveNote()} disabled={saveLoading} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>save</span>
                                    {saveLoading ? "Saving..." : "Save"}
                                </button>
                                <button type="button" onClick={handleGenerateAiAnswer} disabled={aiLoading || !question.trim()} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>psychology</span>
                                    {aiLoading ? "Generating..." : "Answer with AI"}
                                </button>
                            </div>
                        </div>

                        <div className="note-options-toggle">
                            <button type="button" onClick={() => setShowChooseOptions((prev) => !prev)}>
                                {showChooseOptions ? "Hide Options" : "Choose Options"}
                            </button>
                        </div>

                        {showChooseOptions && (
                            <div className="note-form-grid">
                                <label>
                                    Domain
                                    <select value={domain} onChange={(e) => { setDomain(e.target.value); setIsDirty(true) }}>
                                        {Object.keys(DOMAIN_MAP).map((name) => <option key={name} value={name}>{name}</option>)}
                                    </select>
                                </label>
                                <label>
                                    Subdomain
                                    <select value={subdomain} onChange={(e) => { setSubdomain(e.target.value); setIsDirty(true) }}>
                                        {subdomains.map((name) => <option key={name} value={name}>{name}</option>)}
                                    </select>
                                </label>
                                <label>
                                    Difficulty
                                    <select value={difficulty} onChange={(e) => { setDifficulty(e.target.value); setIsDirty(true) }}>
                                        <option value="easy">Easy</option>
                                        <option value="medium">Medium</option>
                                        <option value="hard">Hard</option>
                                    </select>
                                </label>
                                <label>
                                    Status
                                    <select value={status} onChange={(e) => { setStatus(e.target.value); setIsDirty(true) }}>
                                        <option value="done">Understood</option>
                                        <option value="needs_revision">Needs Revision</option>
                                    </select>
                                </label>
                                <label>
                                    Book Marked
                                    <select value={bookmarked ? "yes" : "no"} onChange={(e) => { setBookmarked(e.target.value === "yes"); setIsDirty(true) }}>
                                        <option value="no">No</option>
                                        <option value="yes">Yes</option>
                                    </select>
                                </label>
                                <label>
                                    Confidence (1-5)
                                    <input type="number" min="1" max="5" value={confidence} onChange={(e) => { setConfidence(e.target.value); setIsDirty(true) }} />
                                </label>
                            </div>
                        )}

                        <label className="full-width">
                            Question
                            <textarea value={question} onChange={(e) => { setQuestion(e.target.value); setIsDirty(true) }} />
                        </label>

                        <div className="note-form-grid single-field">
                            <label>
                                Interview Source
                                <input value={sourceTag} onChange={(e) => { setSourceTag(e.target.value); setIsDirty(true) }} placeholder="Asked in Google 2024" />
                            </label>
                        </div>

                        <div className="editor-toolbar">
                            {TOOLBAR_ACTIONS.map((action) => (
                                <button key={action.label} type="button" onClick={() => exec(action.command, action.value)}>
                                    {action.label}
                                </button>
                            ))}
                            <button type="button" onClick={() => setTextColor("#8ec9f4")}>Text Blue</button>
                            <button type="button" onClick={() => setTextColor("#9fe7cb")}>Text Green</button>
                            <button type="button" onClick={setDefaultTextColor}>Text Original</button>
                            <button type="button" onClick={setHighlight}>HL Yellow</button>
                            <button type="button" onClick={clearHighlight}>HL Original</button>
                        </div>

                        {aiLimitMessage && <p className="notes-error editor-error">{aiLimitMessage}</p>}

                        <div
                            ref={editorRef}
                            className="notes-editor"
                            contentEditable
                            suppressContentEditableWarning
                            onInput={() => {
                                setAnswer(editorRef.current?.innerText || "")
                                setIsDirty(true)
                            }}
                        />

                        <p className="notes-meta">{isDirty ? "Autosave pending (every 30s)." : "Saved."}</p>
                    </article>

                    <article className="notes-panel notes-stats-panel">
                        <h3>Overall Statistics</h3>
                        <div className="notes-stats-visual">
                            <div className="notes-pie-wrap enhanced">
                                <div className="notes-pie" style={chart.style} aria-label="Notes status distribution chart">
                                    <div className="notes-pie-center">
                                        <strong>{stats.generated}</strong>
                                        <span>Total</span>
                                    </div>
                                </div>
                                <div className="notes-pie-legend">
                                    <p><span className="dot dot-understood" />Understood: {stats.understood}</p>
                                    <p><span className="dot dot-revision" />Needs Revision: {stats.needsRevision}</p>
                                </div>
                            </div>
                            <div className="notes-visual-bars">
                                <article className="notes-stat-row understood">
                                    <div>
                                        <p>Understood</p>
                                        <strong>{chart.understoodPct}%</strong>
                                    </div>
                                    <div className="notes-stat-row__bar"><i style={{ width: `${chart.understoodPct}%` }} /></div>
                                </article>
                                <article className="notes-stat-row revision">
                                    <div>
                                        <p>Needs Revision</p>
                                        <strong>{chart.revisionPct}%</strong>
                                    </div>
                                    <div className="notes-stat-row__bar"><i style={{ width: `${chart.revisionPct}%` }} /></div>
                                </article>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginTop: '0.6rem' }}>
                            <div className="stat-box">
                                <p>Mastery Rate</p>
                                <strong>{stats.successRate}%</strong>
                            </div>
                            <div className="stat-box">
                                <p>Avg Confidence</p>
                                <strong>{stats.averageConfidence}/5</strong>
                            </div>
                            <div className="stat-box">
                                <p>Bookmarked</p>
                                <strong>{stats.bookmarkedCount}</strong>
                            </div>
                            <div className="stat-box">
                                <p>Visible</p>
                                <strong>{stats.visibleAfterFilter}</strong>
                            </div>
                        </div>

                        <p className="notes-meta" style={{ marginTop: '0.6rem' }}>Selected for export: {selectedIds.length}</p>
                    </article>
                </div>

                <div className="notes-flash">
                    {error && !aiLimitMessage && <p className="notes-error">{error}</p>}
                    {message && <p className="notes-success">{message}</p>}
                </div>

                <footer className="dashboard-footer">
                    <a href="#" onClick={(e) => e.preventDefault()}>Privacy</a>
                    <a href="#" onClick={(e) => e.preventDefault()}>Terms</a>
                    <a href="#" onClick={(e) => e.preventDefault()}>Support</a>
                </footer>
            </section>

            {showAllNotes && (
                <section className="history-modal-overlay" onClick={() => setShowAllNotes(false)}>
                    <article className="history-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="history-modal__head">
                            <h3>All Questions</h3>
                            <div className="history-modal__actions">
                                <button type="button" onClick={() => setShowAllNotes(false)}>Close</button>
                            </div>
                        </div>
                        <div className="history-modal__list">
                            {displayedNotes.map((note) => (
                                <div className="history-modal__item" key={note._id}>
                                    <div className="history-modal__item-main">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(note._id)}
                                            onChange={() => toggleSelect(note._id)}
                                        />
                                        <div>
                                        <strong>{note.question}</strong>
                                        <p>{note.domain} / {note.subdomain}</p>
                                        </div>
                                    </div>
                                    <div className="history-modal__actions">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setActiveId(note._id)
                                                setIsCreatingNew(false)
                                                setShowAllNotes(false)
                                            }}
                                        >
                                            Open
                                        </button>
                                        <button type="button" onClick={() => handleDelete(note._id)}>Delete</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="history-modal__actions notes-modal-export">
                            <span>{selectedIds.length} selected</span>
                            <button type="button" className="modal-export-btn" onClick={handleExportSelected}>
                                Export Selected PDF
                            </button>
                        </div>
                    </article>
                </section>
            )}
        </main>
    )
}

export default Notes
