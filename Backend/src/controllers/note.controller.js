const { noteModel, NOTE_DOMAIN_MAP } = require("../models/note.model")
const { generatePdfFromHtml, generateNoteAnswer } = require("../services/ai.service")
const pdfParse = require("pdf-parse")
const mammoth = require("mammoth")
const WordExtractor = require("word-extractor")
const os = require("os")
const fs = require("fs/promises")
const path = require("path")
const MAX_NOTES_PER_USER = 300

function parseTags(input = "") {
    if (Array.isArray(input)) {
        return input
            .map((tag) => String(tag || "").trim().replace(/^#*/, ""))
            .filter(Boolean)
            .slice(0, 12)
    }

    return String(input || "")
        .split(/[,\s]+/)
        .map((tag) => tag.trim().replace(/^#*/, ""))
        .filter(Boolean)
        .slice(0, 12)
}

function sanitizeHtml(html = "") {
    return String(html || "")
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
        .replace(/on\w+="[^"]*"/gi, "")
}

function validateDomainSubdomain(domain, subdomain) {
    const allowedSubdomains = NOTE_DOMAIN_MAP[domain] || []
    return allowedSubdomains.includes(subdomain)
}

function normalizeImportedQuestion(originalName = "") {
    const withoutExt = String(originalName || "").replace(/\.[^.]+$/, "").trim()
    if (!withoutExt) {
        return "Imported Note"
    }
    return `Imported: ${withoutExt}`.slice(0, 600)
}

function plainTextToHtml(input = "") {
    const escaped = String(input || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
    return `<p>${escaped.replace(/\n/g, "<br/>")}</p>`
}

function splitImportedTextIntoNotes(rawText = "", fileName = "") {
    const cleaned = String(rawText || "")
        .replace(/\r\n/g, "\n")
        .replace(/\t/g, " ")
        .replace(/\u00a0/g, " ")
        .trim()

    if (!cleaned) return []

    const lines = cleaned
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)

    if (!lines.length) return []

    const questionStartRegex = /^(q(?:uestion)?[\s\-:#]*\d*[\).:-]?\s+.+|(?:\d+|[ivxlcdm]+)[\).:-]\s+.+|\-\s+.+\?|.+\?)$/i
    const headingRegex = /^#{1,3}\s+.+|^[A-Z][A-Za-z0-9 /&(),:-]{4,80}$/

    const segments = []
    let current = []

    const pushCurrent = () => {
        if (!current.length) return
        const text = current.join("\n").trim()
        if (text) segments.push(text)
        current = []
    }

    for (const line of lines) {
        const isLikelyQuestionStart = questionStartRegex.test(line)
        const isShortHeading = line.length <= 90 && headingRegex.test(line)
        const shouldStartNew = current.length > 0 && (isLikelyQuestionStart || isShortHeading)

        if (shouldStartNew) {
            pushCurrent()
        }
        current.push(line)
    }
    pushCurrent()

    const normalizedSegments = segments
        .map((segment) => segment.replace(/\n{3,}/g, "\n\n").trim())
        .filter(Boolean)

    const compacted = normalizedSegments.length > 1
        ? normalizedSegments
        : cleaned
            .split(/\n{2,}/)
            .map((segment) => segment.trim())
            .filter(Boolean)

    const finalSegments = compacted.length ? compacted : [ cleaned ]
    const defaultQuestionBase = normalizeImportedQuestion(fileName)

    return finalSegments.slice(0, 25).map((segment, index) => {
        const firstLine = segment.split("\n")[0] || ""
        const shortQuestion = firstLine.length > 600 ? firstLine.slice(0, 600) : firstLine
        const question = shortQuestion || `${defaultQuestionBase} - Part ${index + 1}`
        return {
            question: question.slice(0, 600),
            answer: segment.slice(0, 5000)
        }
    })
}

async function extractTextFromUpload(file) {
    const extension = path.extname(file?.originalname || "").toLowerCase()
    const mimeType = file?.mimetype || ""

    const isPdf = mimeType === "application/pdf" || extension === ".pdf"
    const isDocx = mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || extension === ".docx"
    const isDoc = mimeType === "application/msword" || extension === ".doc"

    if (isPdf) {
        const parsed = await (new pdfParse.PDFParse(Uint8Array.from(file.buffer))).getText()
        return (parsed.text || "").trim()
    }

    if (isDocx) {
        const result = await mammoth.extractRawText({ buffer: file.buffer })
        return (result.value || "").trim()
    }

    if (isDoc) {
        const extractor = new WordExtractor()
        const tempPath = path.join(
            os.tmpdir(),
            `intelliprep_note_${Date.now()}_${Math.random().toString(36).slice(2)}.doc`
        )

        try {
            await fs.writeFile(tempPath, file.buffer)
            const extractedDoc = await extractor.extract(tempPath)
            return (extractedDoc.getBody() || "").trim()
        } finally {
            await fs.unlink(tempPath).catch(() => {})
        }
    }

    throw new Error("Unsupported file format. Please upload PDF, DOC or DOCX.")
}

function computeSpacedRepetitionDate(status) {
    if (status !== "done") {
        return null
    }
    const next = new Date()
    next.setDate(next.getDate() + 7)
    return next
}

async function createNoteController(req, res) {
    const {
        domain,
        subdomain,
        question,
        answer = "",
        answerHtml = "",
        tags = [],
        difficulty = "medium",
        status = "pending",
        bookmarked = false,
        sourceTag = "",
        confidence = 3
    } = req.body || {}

    if (!domain || !subdomain || !String(question || "").trim()) {
        return res.status(400).json({
            message: "Domain, subdomain and question are required."
        })
    }

    if (!validateDomainSubdomain(domain, subdomain)) {
        return res.status(400).json({
            message: "Invalid subdomain for the selected domain."
        })
    }

    const totalNotes = await noteModel.countDocuments({ user: req.user.id })
    if (totalNotes >= MAX_NOTES_PER_USER) {
        return res.status(400).json({
            message: "Notes limit reached, download some of them to clear space."
        })
    }

    const note = await noteModel.create({
        user: req.user.id,
        domain,
        subdomain,
        question: String(question).trim().slice(0, 600),
        answer: String(answer || "").trim().slice(0, 5000),
        answerHtml: sanitizeHtml(answerHtml).slice(0, 20000),
        tags: parseTags(tags),
        difficulty,
        status,
        bookmarked: Boolean(bookmarked),
        sourceTag: String(sourceTag || "").trim().slice(0, 120),
        confidence: Math.max(1, Math.min(5, Number(confidence || 3))),
        spacedRepetitionDueAt: computeSpacedRepetitionDate(status)
    })

    return res.status(201).json({
        message: "Note created successfully.",
        note
    })
}

async function getNotesController(req, res) {
    const { view = "all", search = "", domain = "" } = req.query
    const query = { user: req.user.id }

    if (domain && NOTE_DOMAIN_MAP[domain]) {
        query.domain = domain
    }

    if (search) {
        const safeSearch = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        query.$or = [
            { question: { $regex: safeSearch, $options: "i" } },
            { answer: { $regex: safeSearch, $options: "i" } },
            { domain: { $regex: safeSearch, $options: "i" } },
            { subdomain: { $regex: safeSearch, $options: "i" } },
            { sourceTag: { $regex: safeSearch, $options: "i" } },
            { tags: { $elemMatch: { $regex: safeSearch, $options: "i" } } }
        ]
    }

    if (view === "pending") {
        query.status = "pending"
    } else if (view === "needs_revision") {
        query.status = "needs_revision"
    } else if (view === "bookmarked") {
        query.bookmarked = true
    } else if (view === "done") {
        query.status = "done"
    }

    const notes = await noteModel.find(query).sort({ updatedAt: -1 })

    return res.status(200).json({
        message: "Notes fetched successfully.",
        notes
    })
}

async function updateNoteController(req, res) {
    const { noteId } = req.params
    const updates = req.body || {}

    const note = await noteModel.findOne({ _id: noteId, user: req.user.id })
    if (!note) {
        return res.status(404).json({
            message: "Note not found."
        })
    }

    if (typeof updates.domain === "string") {
        note.domain = updates.domain
    }
    if (typeof updates.subdomain === "string") {
        note.subdomain = updates.subdomain
    }
    if (!validateDomainSubdomain(note.domain, note.subdomain)) {
        return res.status(400).json({
            message: "Invalid subdomain for the selected domain."
        })
    }

    if (typeof updates.question === "string") {
        note.question = updates.question.trim().slice(0, 600)
    }
    if (typeof updates.answer === "string") {
        note.answer = updates.answer.trim().slice(0, 5000)
    }
    if (typeof updates.answerHtml === "string") {
        note.answerHtml = sanitizeHtml(updates.answerHtml).slice(0, 20000)
    }
    if (updates.tags !== undefined) {
        note.tags = parseTags(updates.tags)
    }
    if (typeof updates.difficulty === "string") {
        note.difficulty = updates.difficulty
    }
    if (typeof updates.status === "string") {
        note.status = updates.status
        note.spacedRepetitionDueAt = computeSpacedRepetitionDate(updates.status)
    }
    if (typeof updates.bookmarked === "boolean") {
        note.bookmarked = updates.bookmarked
    }
    if (typeof updates.sourceTag === "string") {
        note.sourceTag = updates.sourceTag.trim().slice(0, 120)
    }
    if (updates.confidence !== undefined) {
        note.confidence = Math.max(1, Math.min(5, Number(updates.confidence || 3)))
    }

    await note.save()

    return res.status(200).json({
        message: "Note updated successfully.",
        note
    })
}

async function deleteNoteController(req, res) {
    const { noteId } = req.params
    const deleted = await noteModel.findOneAndDelete({ _id: noteId, user: req.user.id })

    if (!deleted) {
        return res.status(404).json({
            message: "Note not found."
        })
    }

    return res.status(200).json({
        message: "Note deleted successfully."
    })
}

async function exportNotesPdfController(req, res) {
    const { noteIds = [] } = req.body || {}
    const ids = Array.isArray(noteIds) ? noteIds : []

    const query = { user: req.user.id }
    if (ids.length > 0) {
        query._id = { $in: ids }
    }

    const notes = await noteModel.find(query).sort({ updatedAt: -1 }).limit(100)
    if (!notes.length) {
        return res.status(400).json({
            message: "No notes found to export."
        })
    }

    const formatStatus = (status) => {
        if (status === "done") return "Understood"
        if (status === "needs_revision") return "Needs Revision"
        return "Pending"
    }

    const rows = notes.map((note, index) => {
        const tagText = (note.tags || []).map((t) => `#${t}`).join(" ")
        const answerBlock = note.answerHtml || `<p>${(note.answer || "No answer yet.").replace(/\n/g, "<br/>")}</p>`
        const sourceTag = note.sourceTag ? `<span class="chip">Source: ${note.sourceTag}</span>` : ""
        const bookmarkTag = note.bookmarked ? `<span class="chip">Bookmarked</span>` : ""

        return `
            <section class="question-card">
                <h2 class="q-heading">Q-${index + 1}</h2>
                <p class="line"><span class="label">Question - </span>${note.question}</p>
                <div class="meta-row">
                    <span class="chip">Domain: ${note.domain}</span>
                    <span class="chip">Subdomain: ${note.subdomain}</span>
                    <span class="chip">Difficulty: ${String(note.difficulty || "").toUpperCase()}</span>
                    <span class="chip">Status: ${formatStatus(note.status)}</span>
                    <span class="chip">Confidence: ${note.confidence || 3}/5</span>
                    ${sourceTag}
                    ${bookmarkTag}
                </div>
                <div class="answer-wrap">
                    <p class="label answer-label">Answer - </p>
                    <div class="answer-body">${answerBlock}</div>
                </div>
            </section>
        `
    }).join("")

    const html = `
        <html>
            <head>
                <style>
                    * { box-sizing: border-box; }
                    body {
                        font-family: Arial, sans-serif;
                        padding: 20px;
                        color: #0f1b29;
                        background: #ffffff;
                    }
                    .title {
                        margin: 0 0 12px;
                        font-size: 24px;
                        font-weight: 700;
                    }
                    .subtitle {
                        margin: 0 0 20px;
                        color: #4b5d6f;
                        font-size: 12px;
                    }
                    .question-card {
                        border: 1px solid #d7e1ea;
                        border-radius: 10px;
                        padding: 12px;
                        margin-bottom: 14px;
                        page-break-inside: avoid;
                        background: #fcfeff;
                    }
                    .q-heading {
                        margin: 0 0 8px;
                        font-size: 16px;
                        color: #1b4568;
                    }
                    .line {
                        margin: 0 0 8px;
                        font-size: 13px;
                        line-height: 1.5;
                    }
                    .label {
                        font-weight: 700;
                        color: #18364f;
                    }
                    .meta-row {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 6px;
                        margin: 0 0 8px;
                    }
                    .chip {
                        border: 1px solid #c9d8e6;
                        background: #eef5fb;
                        color: #224764;
                        border-radius: 999px;
                        padding: 3px 8px;
                        font-size: 11px;
                    }
                    .answer-wrap {
                        border: 1px solid #dbe5ef;
                        border-radius: 8px;
                        background: #f9fcff;
                        padding: 10px;
                    }
                    .answer-label {
                        margin: 0 0 6px;
                        font-size: 12px;
                    }
                    .answer-body {
                        font-size: 13px;
                        line-height: 1.6;
                    }
                    .answer-body p { margin: 0 0 8px; }
                    .answer-body ul, .answer-body ol { margin: 0 0 8px 18px; }
                    .answer-body pre {
                        margin: 8px 0;
                        padding: 10px;
                        background: #1b2a3a;
                        color: #e9f2fb;
                        border-radius: 6px;
                        overflow-x: auto;
                        white-space: pre-wrap;
                    }
                    .answer-body code {
                        background: #e9f0f7;
                        padding: 1px 4px;
                        border-radius: 4px;
                        font-family: Consolas, monospace;
                    }
                </style>
            </head>
            <body style="font-family: Arial, sans-serif; padding: 20px; color: #0e1a25;">
                <h1 class="title">IntelliPrep Notes</h1>
                ${rows}
            </body>
        </html>
    `

    const pdfBuffer = await generatePdfFromHtml(html)
    res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=intelliprep_notes.pdf"
    })

    return res.send(pdfBuffer)
}

async function generateAiAnswerController(req, res) {
    const { domain, subdomain, question, sourceTag = "", difficulty = "medium" } = req.body || {}

    if (!domain || !subdomain || !String(question || "").trim()) {
        return res.status(400).json({
            message: "Domain, subdomain and question are required."
        })
    }

    if (!validateDomainSubdomain(domain, subdomain)) {
        return res.status(400).json({
            message: "Invalid subdomain for the selected domain."
        })
    }

    try {
        const aiAnswer = await generateNoteAnswer({
            domain,
            subdomain,
            question: String(question).trim().slice(0, 600),
            sourceTag: String(sourceTag || "").trim().slice(0, 120),
            difficulty
        })

        return res.status(200).json({
            message: "AI answer generated successfully.",
            aiAnswer
        })
    } catch (error) {
        const normalizedMessage = String(error?.message || "").toLowerCase()
        const statusCode = Number(error?.status || error?.statusCode || 0)
        const isAiLimitError = statusCode === 429
            || normalizedMessage.includes("resource_exhausted")
            || normalizedMessage.includes("quota")
            || normalizedMessage.includes("rate limit")
            || normalizedMessage.includes("too many requests")
            || normalizedMessage.includes("429")

        if (isAiLimitError) {
            return res.status(429).json({
                message: "You have reached limit. Please answer yourself."
            })
        }

        return res.status(400).json({
            message: error?.message || "Unable to generate AI answer."
        })
    }
}

async function importNoteFromPdfController(req, res) {
    const uploadedFile = req.file

    if (!uploadedFile) {
        return res.status(400).json({
            message: "Please select a PDF, DOC or DOCX file to import."
        })
    }

    const totalNotes = await noteModel.countDocuments({ user: req.user.id })
    if (totalNotes >= MAX_NOTES_PER_USER) {
        return res.status(400).json({
            message: "Notes limit reached, download some of them to clear space."
        })
    }

    let extractedText = ""
    try {
        extractedText = await extractTextFromUpload(uploadedFile)
    } catch (error) {
        return res.status(400).json({
            message: error?.message || "Unable to parse uploaded file."
        })
    }

    if (!extractedText.trim()) {
        return res.status(400).json({
            message: "No readable text found in uploaded file."
        })
    }

    const splitNotes = splitImportedTextIntoNotes(extractedText, uploadedFile.originalname)
    const remainingSlots = Math.max(0, MAX_NOTES_PER_USER - totalNotes)
    const notesToCreate = splitNotes.slice(0, remainingSlots)

    if (!notesToCreate.length) {
        return res.status(400).json({
            message: "Notes limit reached, download some of them to clear space."
        })
    }

    const sourceTag = `Imported from ${String(uploadedFile.originalname || "file").slice(0, 80)}`
    const payload = notesToCreate.map((item, index) => {
        const baseQuestion = item.question || `${normalizeImportedQuestion(uploadedFile.originalname)} - Part ${index + 1}`
        return {
            user: req.user.id,
            domain: "Technical",
            subdomain: "DSA",
            question: baseQuestion.slice(0, 600),
            answer: String(item.answer || "").slice(0, 5000),
            answerHtml: sanitizeHtml(plainTextToHtml(String(item.answer || "").slice(0, 5000))).slice(0, 20000),
            difficulty: "medium",
            status: "pending",
            bookmarked: false,
            sourceTag,
            confidence: 3,
            spacedRepetitionDueAt: null
        }
    })

    const notes = await noteModel.insertMany(payload)
    const skippedCount = Math.max(0, splitNotes.length - notes.length)

    return res.status(201).json({
        message: notes.length === 1
            ? "1 note imported successfully."
            : `${notes.length} notes imported successfully.`,
        notes,
        importedCount: notes.length,
        skippedCount
    })
}

module.exports = {
    createNoteController,
    getNotesController,
    updateNoteController,
    deleteNoteController,
    exportNotesPdfController,
    generateAiAnswerController,
    importNoteFromPdfController,
    NOTE_DOMAIN_MAP
}
