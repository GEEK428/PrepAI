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
    
    // Pagination
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalCount, setTotalCount] = useState(0)

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
    
    const stats = useMemo(() => {
        const understood = notes.filter((item) => item.status === "done").length
        const total = totalCount || notes.length
        const successRate = total ? Math.round((understood / notes.length) * 100) : 0
        
        let totalConfidence = 0
        notes.forEach(n => {
            totalConfidence += (n.confidence || 0)
        })
        const avgConfidence = notes.length > 0 ? (totalConfidence / notes.length).toFixed(1) : "0.0"

        return { understood, successRate, total, avgConfidence }
    }, [ notes, totalCount ])

    const pieChartStyle = useMemo(() => {
        const total = Math.max(1, notes.length)
        const understood = notes.filter(n => n.status === "done").length
        return { background: `conic-gradient(#6fb2e3 0deg ${(understood / total) * 360}deg, rgba(255,255,255,0.05) ${(understood / total) * 360}deg 360deg)` }
    }, [ notes ])

    const loadNotes = async (p = page) => {
        setLoading(true)
        try {
            const response = await getNotes({ 
                view: "all", 
                page: p, 
                limit: 15,
                search: search,
                domain: filterDomain === "all" ? "" : filterDomain,
                subdomain: filterSubdomain === "all" ? "" : filterSubdomain,
                difficulty: filterDifficulty === "all" ? "" : filterDifficulty,
                status: filterUnderstanding === "all" ? "" : filterUnderstanding,
                bookmarked: filterBookmarked === "all" ? "" : (filterBookmarked === "yes"),
                confidence: filterConfidence === "all" ? "" : Number(filterConfidence)
            })
            setNotes(response?.notes || [])
            setTotalPages(response?.totalPages || 1)
            setTotalCount(response?.totalCount || 0)
        } catch (err) { setError("Unable to load notes.") }
        finally { setLoading(false) }
    }

    useEffect(() => { loadNotes(1); setPage(1) }, [ filterDomain, filterSubdomain, filterDifficulty, filterUnderstanding, filterBookmarked, filterConfidence ])
    
    // Search with debounce logic would be better but simple reload for now
    useEffect(() => {
        const timer = setTimeout(() => {
            loadNotes(1)
            setPage(1)
        }, 500)
        return () => clearTimeout(timer)
    }, [ search ])

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
    }, [ activeId ])

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

    const toggleSelect = id => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])

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

    const exec = cmd => {
        document.execCommand(cmd, false, null)
        setAnswer(editorRef.current?.innerText || "")
        setIsDirty(true)
    }

    const execHighlight = (color) => {
        document.execCommand("hiliteColor", false, color)
        setAnswer(editorRef.current?.innerText || "")
        setIsDirty(true)
    }

    const execFontColor = (color) => {
        document.execCommand("foreColor", false, color)
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
                            placeholder="Search keywords..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => { if(e.key === 'Enter') loadNotes(1) }}
                        />
                    </div>
                </div>
                

                <div className="notes-content-grid">
                    <div className="notes-column-left">
                        <div className="column-head">
                            <h2>Questions ({totalCount})</h2>
                            <div className="column-head-actions">
                                <button className="filter-chip" onClick={handleExportSelected} disabled={!selectedIds.length}>
                                    <span className="material-symbols-outlined">download</span> Export
                                </button>
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
                                            <option value="all">All Domains</option>
                                            <option value="Technical">Technical</option>
                                            <option value="Behavioral">Behavioral</option>
                                            <option value="Role Specific">Role Based</option>
                                        </select>
                                    </label>
                                    <label>Subdomain
                                        <select value={filterSubdomain} onChange={(e) => setFilterSubdomain(e.target.value)}>
                                            <option value="all">All Subdomains</option>
                                            {filterSubdomainOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </label>
                                    <label>Difficulty
                                        <select value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)}>
                                            <option value="all">All Difficulty</option>
                                            <option value="easy">Easy</option>
                                            <option value="medium">Medium</option>
                                            <option value="hard">Hard</option>
                                        </select>
                                    </label>
                                    <label>Confidence
                                        <select value={filterConfidence} onChange={(e) => setFilterConfidence(e.target.value)}>
                                            <option value="all">Any Confidence</option>
                                            {[1,2,3,4,5].map(c => <option key={c} value={c}>{c} Stars</option>)}
                                        </select>
                                    </label>
                                    <label>Status
                                        <select value={filterUnderstanding} onChange={(e) => setFilterUnderstanding(e.target.value)}>
                                            <option value="all">All Status</option>
                                            <option value="done">Review Ready</option>
                                            <option value="needs_revision">In Progress</option>
                                        </select>
                                    </label>
                                    <label>Bookmark
                                        <select value={filterBookmarked} onChange={(e) => setFilterBookmarked(e.target.value)}>
                                            <option value="all">All Notes</option>
                                            <option value="yes">Bookmarked</option>
                                            <option value="no">Not Bookmarked</option>
                                        </select>
                                    </label>
                                </div>
                            </div>
                        )}

                        <div className="notes-card-list scroll-area">
                            {notes.map((note) => (
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
                            {!loading && !notes.length && <p className="empty-msg">No questions found.</p>}
                            {loading && <Loader />}
                        </div>

                        {/* PAGINATION CONTROLS */}
                        <div className="notes-pagination-bar">
                            <button disabled={page <= 1} onClick={() => { setPage(p => p - 1); loadNotes(page - 1) }}>Prev</button>
                            <span>Page {page} of {totalPages}</span>
                            <button disabled={page >= totalPages} onClick={() => { setPage(p => p + 1); loadNotes(page + 1) }}>Next</button>
                        </div>

                        <div className="notes-bottom-bar card-glass">
                            <p>{selectedIds.length} selected</p>
                        </div>
                    </div>

                    <div className="notes-column-right">
                        <div className="prep-form-card card-glass">
                            <div className="form-head">
                                <span className="material-symbols-outlined add-circle">{activeId ? "edit" : "add_circle"}</span>
                                <h2>{activeId ? "Edit" : "New"} Question</h2>
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
                                            <button className="hl-green" onClick={() => execHighlight('#a8f0c0')} title="Highlight Green">🟢</button>
                                            <button className="hl-yellow" onClick={() => execHighlight('#fff59d')} title="Highlight Yellow">🟡</button>
                                            <button className="fc-green" onClick={() => execFontColor('#2e7d32')} title="Green Text">A</button>
                                            <button className="fc-yellow" onClick={() => execFontColor('#f9a825')} title="Yellow Text">A</button>
                                            <button onClick={handleGenerateAiAnswer} className="ai-tool" disabled={aiLoading}>
                                                {aiLoading ? "Thinking..." : "AI Answer"}
                                            </button>
                                        </div>
                                        <div 
                                            ref={editorRef} 
                                            className="custom-editor" 
                                            contentEditable 
                                            onInput={() => setAnswer(editorRef.current.innerText)}
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
