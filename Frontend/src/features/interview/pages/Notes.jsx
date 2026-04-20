import React, { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router"
import "../style/home.scss"
import "../style/notes.scss"
import { createNote, deleteNote, exportNotesPdf, generateAiAnswer, getNotes, updateNote } from "../services/notes.api"
import Sidebar from "../components/Sidebar"
import TopBar from "../components/TopBar"
import Loader from "../../../components/Loader"

const COMMON_SUBDOMAINS = [
    "None", "DSA", "Core Domain", "Developement", "Cybersecurity", "AI", "ML", "Data Science", "System Design", "Cloud/Devops"
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
    if (status === "done") return "Review Ready"
    if (status === "needs_revision") return "In Progress"
    return "Review Ready"
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
    
    // Original Filter States
    const [filterDomain, setFilterDomain] = useState("all")
    const [filterSubdomain, setFilterSubdomain] = useState("all")
    const [filterDifficulty, setFilterDifficulty] = useState("all")
    const [filterUnderstanding, setFilterUnderstanding] = useState("all")
    const [filterConfidence, setFilterConfidence] = useState("all")
    const [filterBookmarked, setFilterBookmarked] = useState("all")
    const [showFilterOptions, setShowFilterOptions] = useState(false)

    // Original Form States
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
            const haystack = [note.question, note.answer, note.domain, note.subdomain, note.sourceTag].join(" ").toLowerCase()
            return haystack.includes(q)
        })
    }, [ notes, filterDomain, filterSubdomain, filterDifficulty, filterUnderstanding, filterBookmarked, filterConfidence, search ])

    const stats = useMemo(() => {
        const understood = notes.filter((item) => item.status === "done").length
        const needsRevision = notes.filter((item) => item.status === "needs_revision").length
        const total = notes.length
        const successRate = total ? Math.round((understood / total) * 100) : 0
        
        // Categories Mastered Logic
        const domainCounts = {}
        notes.forEach(n => {
            domainCounts[n.domain] = (domainCounts[n.domain] || { total: 0, done: 0 })
            domainCounts[n.domain].total++
            if (n.status === "done") domainCounts[n.domain].done++
        })
        const mastered = Object.values(domainCounts).filter(d => d.total > 0 && d.done === d.total).length

        return { understood, needsRevision, successRate, total, mastered }
    }, [ notes ])

    const pieChartStyle = useMemo(() => {
        const total = Math.max(1, stats.total)
        return { background: `conic-gradient(#00cfb1 0deg ${(stats.understood / total) * 360}deg, #151d28 ${(stats.understood / total) * 360}deg 360deg)` }
    }, [ stats ])

    const loadNotes = async () => {
        setLoading(true)
        try {
            const response = await getNotes({ view: "all" })
            setNotes(response?.notes || [])
        } catch (err) { setError("Unable to load notes.") }
        finally { setLoading(false) }
    }

    useEffect(() => { loadNotes() }, [])

    useEffect(() => {
        if (!activeNote) return
        setIsCreatingNew(false)
        setDomain(activeNote.domain || "Technical")
        setSubdomain(activeNote.subdomain || "DSA")
        setQuestion(activeNote.question || "")
        setAnswer(activeNote.answer || "")
        setDifficulty(activeNote.difficulty || "medium")
        setStatus(activeNote.status || "done")
        setBookmarked(Boolean(activeNote.bookmarked))
        setSourceTag(activeNote.sourceTag || "")
        setConfidence(activeNote.confidence || 3)
        if (editorRef.current) editorRef.current.innerHTML = activeNote.answerHtml || activeNote.answer || ""
        setIsDirty(false)
    }, [ activeNote ])

    const handleSaveNote = async () => {
        if (!question.trim()) return setError("Question is required.")
        setSaveLoading(true)
        const payload = {
            domain, subdomain, question: question.trim(), answer: answer.trim(),
            answerHtml: editorRef.current?.innerHTML || "", difficulty, status,
            bookmarked, sourceTag, confidence
        }
        try {
            if (isCreatingNew) {
                const res = await createNote(payload)
                setNotes(prev => [res.note, ...prev])
                resetForm()
            } else {
                const res = await updateNote(activeId, payload)
                setNotes(prev => prev.map(n => n._id === res.note._id ? res.note : n))
            }
            setMessage("Changes saved successfully.")
        } catch (err) { setError("Failed to save.") }
        finally { setSaveLoading(false) }
    }

    const resetForm = () => {
        setIsCreatingNew(true)
        setActiveId("")
        setQuestion("")
        setAnswer("")
        setSubdomain(DOMAIN_MAP[domain]?.[0] || "")
        if (editorRef.current) editorRef.current.innerHTML = ""
        setIsDirty(false)
    }

    const handleDelete = async (e, id) => {
        e.stopPropagation()
        if (!window.confirm("Delete this question?")) return
        try {
            await deleteNote(id)
            setNotes(prev => prev.filter(n => n._id !== id))
            if (activeId === id) resetForm()
        } catch (err) { setError("Delete failed.") }
    }

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
    }

    const handleExportSelected = async () => {
        if (!selectedIds.length) {
            setError("No file selected for export.")
            setTimeout(() => setError(""), 3000)
            return
        }
        try {
            const blob = await exportNotesPdf(selectedIds)
            const url = window.URL.createObjectURL(new Blob([blob], { type: "application/pdf" }))
            const link = document.createElement("a")
            link.href = url
            link.setAttribute("download", "intelliprep_notes.pdf")
            document.body.appendChild(link)
            link.click()
            link.remove()
        } catch (err) { setError("Export failed.") }
    }

    const handleGenerateAiAnswer = async () => {
        if (!question.trim()) return setError("Enter a question first.")
        setAiLoading(true)
        setError("")
        try {
            const res = await generateAiAnswer({ domain, subdomain, question, sourceTag, difficulty })
            const html = res.aiAnswer.answerHtml || `<p>${res.aiAnswer.answerText}</p>`
            if (editorRef.current) editorRef.current.innerHTML = html
            setAnswer(res.aiAnswer.answerText)
            setIsDirty(true)
        } catch (err) { setError("AI failed.") }
        finally { setAiLoading(false) }
    }

    const exec = (cmd) => {
        document.execCommand(cmd, false, null)
        setAnswer(editorRef.current?.innerText || "")
        setIsDirty(true)
    }

    const subdomains = DOMAIN_MAP[domain] || []
    const filterSubdomainOptions = filterDomain === "all" ? COMMON_SUBDOMAINS : (DOMAIN_MAP[filterDomain] || [])

    return (
        <main className="dashboard-page">
            <Sidebar />

            <section className="dashboard-main notes-main">
                <TopBar />

                {/* SEARCH BAR (TOP) */}
                <div className="notes-search-row">
                    <div className="notes-search-wrap">
                        <span className="material-symbols-outlined search-icon">search</span>
                        <input
                            className="notes-search"
                            placeholder="Search by keywords..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
                
                {/* STATS HEADER */}
                <header className="notes-optimized-header compact-view">
                    <div className="velocity-card card-glass small-card">
                        <div className="velocity-header">
                            <p>PREPARATION SCORE</p>
                            <div className="velocity-main">
                                <h1>{stats.successRate}%</h1>
                                <span className="velocity-meta">Questions prepared vs total</span>
                            </div>
                        </div>
                        <div className="velocity-pie-wrap">
                            <div className="velocity-pie small-pie" style={pieChartStyle}>
                                <div className="velocity-pie-inner">
                                    <p>PROGRESS</p>
                                    <strong>{stats.understood} / {stats.total}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="streak-card card-glass small-card">
                        <span className="material-symbols-outlined streak-icon small-icon">workspace_premium</span>
                        <p>DOMAINS MASTERED</p>
                        <h1>{stats.mastered}</h1>
                    </div>
                </header>

                <div className="notes-content-grid">
                    <div className="notes-column-left">
                        <div className="column-head">
                            <h2>Active Question Bank</h2>
                            <div className="column-head-actions">
                                <button className="filter-chip icon-only" onClick={() => setShowFilterOptions(!showFilterOptions)}>
                                    <span className="material-symbols-outlined">filter_list</span>
                                </button>
                                <button className="filter-chip active" onClick={resetForm}>
                                    <span className="material-symbols-outlined">add</span> New
                                </button>
                            </div>
                        </div>

                        {showFilterOptions && (
                            <div className="notes-quick-filters card-glass anim-fade">
                                <div className="filter-grid">
                                    <label>Domain
                                        <select value={filterDomain} onChange={(e) => setFilterDomain(e.target.value)}>
                                            <option value="all">All</option>
                                            <option value="Technical">Technical</option>
                                            <option value="Behavioral">Behavioral</option>
                                            <option value="Role Specific">Role Based</option>
                                        </select>
                                    </label>
                                    <label>Sub Domain
                                        <select value={filterSubdomain} onChange={(e) => setFilterSubdomain(e.target.value)}>
                                            <option value="all">All</option>
                                            {filterSubdomainOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </label>
                                </div>
                            </div>
                        )}

                        <div className="notes-card-list scroll-area">
                            {displayedNotes.map((note) => (
                                <article 
                                    key={note._id} 
                                    className={`note-card card-glass compact-card ${activeId === note._id ? 'active' : ''}`}
                                    onClick={() => setActiveId(note._id)}
                                >
                                    <div className="note-card-badges">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedIds.includes(note._id)} 
                                            onChange={() => toggleSelect(note._id)}
                                            onClick={e => e.stopPropagation()} 
                                        />
                                        <span className={`badge-diff small ${note.difficulty}`}>{note.difficulty.toUpperCase()}</span>
                                        <span className={`badge-status small ${note.status}`}>{statusLabel(note.status).toUpperCase()}</span>
                                    </div>
                                    <h3 className="compact-h3">{note.question}</h3>
                                    <div className="note-card-footer">
                                        <span><i className="material-symbols-outlined small">description</i> {note.subdomain}</span>
                                        <button className="del-btn small-btn" onClick={(e) => handleDelete(e, note._id)}>
                                            <span className="material-symbols-outlined">delete</span>
                                        </button>
                                    </div>
                                </article>
                            ))}
                            {!loading && !displayedNotes.length && <p className="empty-msg">No questions found.</p>}
                            {loading && <Loader />}
                        </div>

                        {/* EXPORT OPTIONS MOVED HERE (JUST BELOW LIST) */}
                        <div className="notes-export-inline card-glass">
                            <p>{selectedIds.length} questions selected</p>
                            <button className="export-btn-compact" onClick={handleExportSelected}>
                                <span className="material-symbols-outlined">download</span> EXPORT PDF
                            </button>
                        </div>
                    </div>

                    <div className="notes-column-right">
                        <div className="prep-form-card card-glass">
                            <div className="form-head">
                                <span className="material-symbols-outlined add-circle">{activeId ? "edit" : "add_circle"}</span>
                                <h2>{activeId ? "Edit Question" : "New Question"}</h2>
                            </div>

                            <div className="form-body">
                                <div className="input-group">
                                    <label>QUESTION TITLE</label>
                                    <textarea 
                                        value={question} 
                                        onChange={e => {setQuestion(e.target.value); setIsDirty(true)}}
                                        style={{ minHeight: '50px' }}
                                    />
                                </div>

                                <div className="form-row">
                                    <div className="input-group">
                                        <label>DOMAIN</label>
                                        <select value={domain} onChange={e => {setDomain(e.target.value); setIsDirty(true)}}>
                                            {Object.keys(DOMAIN_MAP).map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    </div>
                                    <div className="input-group">
                                        <label>SUBDOMAIN</label>
                                        <select value={subdomain} onChange={e => {setSubdomain(e.target.value); setIsDirty(true)}}>
                                            {subdomains.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="input-group">
                                        <label>DIFFICULTY</label>
                                        <select value={difficulty} onChange={e => {setDifficulty(e.target.value); setIsDirty(true)}}>
                                            <option value="easy">Easy</option>
                                            <option value="medium">Medium</option>
                                            <option value="hard">Hard</option>
                                        </select>
                                    </div>
                                    <div className="input-group">
                                        <label>CONFIDENCE (1-5)</label>
                                        <select value={confidence} onChange={e => {setConfidence(e.target.value); setIsDirty(true)}}>
                                            {[1,2,3,4,5].map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="input-group">
                                        <label>UNDERSTANDING</label>
                                        <select value={status} onChange={e => {setStatus(e.target.value); setIsDirty(true)}}>
                                            <option value="done">Review Ready</option>
                                            <option value="needs_revision">In Progress</option>
                                        </select>
                                    </div>
                                    <div className="input-group">
                                        <label>SOURCE TAG</label>
                                        <input value={sourceTag} onChange={e => {setSourceTag(e.target.value); setIsDirty(true)}} />
                                    </div>
                                </div>

                                <div className="input-group">
                                    <label>ANSWER / PREP NOTES</label>
                                    <div className="rich-editor-wrap">
                                        <div className="rich-toolbar">
                                            {TOOLBAR_ACTIONS.map(a => <button key={a.label} onClick={() => exec(a.command)}>{a.label}</button>)}
                                            <button onClick={handleGenerateAiAnswer} className="ai-tool" disabled={aiLoading}>
                                                {aiLoading ? "Generating..." : "AI Answer"}
                                            </button>
                                        </div>
                                        <div 
                                            ref={editorRef} 
                                            className="custom-editor" 
                                            contentEditable 
                                            onInput={() => {setAnswer(editorRef.current.innerText); setIsDirty(true)}}
                                            style={{ minHeight: '120px' }}
                                        />
                                    </div>
                                </div>

                                <button className="submit-btn" onClick={handleSaveNote} disabled={saveLoading}>
                                    {saveLoading ? "SAVING..." : (activeId ? "UPDATE" : "CREATE")}
                                </button>
                                
                                <div className="form-feedback">
                                    {message && <p className="msg-success" style={{fontSize:'0.7rem'}}>{message}</p>}
                                    {error && <p className="msg-error" style={{fontSize:'0.7rem'}}>{error}</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    )
}

export default Notes
