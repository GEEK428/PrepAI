const pdfParse = require("pdf-parse")
const mammoth = require("mammoth")
const WordExtractor = require("word-extractor")
const os = require("os")
const fs = require("fs/promises")
const path = require("path")
const crypto = require("crypto")
const { generateInterviewReport, generateResumePdf, generatePdfFromHtml } = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReport.model")

function extractInsights({ topSkills = [], skillGaps = [] }) {
    const cleanTopSkills = (topSkills || [])
        .filter((skill) => typeof skill === "string" && skill.trim())
        .map((skill) => skill.trim())
        .slice(0, 6)

    const criticalGaps = (skillGaps || [])
        .filter((gap) => typeof gap?.skill === "string" && gap.skill.trim())
        .map((gap) => gap.skill.trim())
        .slice(0, 6)

    return { topSkills: cleanTopSkills, criticalGaps }
}

function deriveTitleFromJobDescription(jobDescription = "") {
    const firstLine = String(jobDescription || "")
        .split("\n")
        .map((line) => line.trim())
        .find(Boolean)

    if (!firstLine) return "Target Role"
    return firstLine.slice(0, 80)
}

function buildFallbackInterviewReport({ jobDescription }) {
    const title = deriveTitleFromJobDescription(jobDescription)
    return {
        matchScore: 60,
        technicalQuestions: [
            {
                question: "Walk us through one project that best matches this role.",
                intention: "Assess role relevance and depth of hands-on experience.",
                answer: "Describe the project context, your role, technical decisions, and measurable impact."
            },
            {
                question: "Which core concepts are most important for this position?",
                intention: "Evaluate your fundamentals and prioritization.",
                answer: "List key concepts from the job description and explain where you applied each one."
            }
        ],
        behavioralQuestions: [
            {
                question: "Tell me about a time you solved a difficult problem under pressure.",
                intention: "Check structured thinking and ownership.",
                answer: "Use STAR format and highlight outcome, trade-offs, and lessons."
            }
        ],
        skillGaps: [],
        topSkills: [],
        preparationPlan: [
            {
                day: 1,
                focus: "Role requirements mapping",
                tasks: [
                    "Map job responsibilities to your experience",
                    "Prepare two impact-focused project stories"
                ]
            },
            {
                day: 2,
                focus: "Interview drills",
                tasks: [
                    "Practice role-specific technical Q&A",
                    "Practice behavioral answers using STAR format"
                ]
            }
        ],
        title
    }
}

function buildFallbackResumeHtml({ resume = "", selfDescription = "", jobDescription = "", title = "Target Role" }) {
    const escape = (value = "") => String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")

    const resumeSnippet = (resume || selfDescription || "No resume text found.")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 35)
        .join("<br/>")

    const jdSnippet = String(jobDescription || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 8)
        .join("<br/>")

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: Arial, sans-serif; color: #1f2933; font-size: 10pt; line-height: 1.45; }
  h1 { margin: 0 0 10px; font-size: 18pt; }
  h2 { margin: 14px 0 6px; font-size: 11pt; text-transform: uppercase; letter-spacing: 0.06em; color: #334e68; }
  .block { border: 1px solid #d7e0ea; border-radius: 8px; padding: 10px; }
</style>
</head>
<body>
  <h1>${escape(title)}</h1>
  <h2>Candidate Snapshot</h2>
  <div class="block">${resumeSnippet ? escape(resumeSnippet) : "No candidate text provided."}</div>
  <h2>Target Job Summary</h2>
  <div class="block">${jdSnippet ? escape(jdSnippet) : "No job description provided."}</div>
</body>
</html>`
}

async function extractResumeTextFromUpload(file) {
    const extension = path.extname(file?.originalname || "").toLowerCase()
    const mimeType = file?.mimetype || ""

    const isPdf  = mimeType === "application/pdf" || extension === ".pdf"
    const isDocx = mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || extension === ".docx"
    const isDoc  = mimeType === "application/msword" || extension === ".doc"

    if (isPdf) {
        const data = await pdfParse(file.buffer)
        return (data.text || "").trim()
    }

    if (isDocx) {
        const result = await mammoth.extractRawText({ buffer: file.buffer })
        return (result.value || "").trim()
    }

    if (isDoc) {
        const extractor = new WordExtractor()
        const tempPath = path.join(
            os.tmpdir(),
            `intelliprep_${Date.now()}_${Math.random().toString(36).slice(2)}.doc`
        )
        try {
            await fs.writeFile(tempPath, file.buffer)
            const extractedDoc = await extractor.extract(tempPath)
            return (extractedDoc.getBody() || "").trim()
        } finally {
            await fs.unlink(tempPath).catch(() => {})
        }
    }

    throw new Error("Unsupported resume format. Please upload PDF, DOC or DOCX.")
}


/**
 * @description Generate interview report from resume + job description.
 */
async function generateInterViewReportController(req, res) {
    const { selfDescription, jobDescription } = req.body
    const resumeFile = req.file

    if (!jobDescription?.trim()) {
        return res.status(400).json({ message: "Job description is required." })
    }
    if (!resumeFile && !selfDescription?.trim()) {
        return res.status(400).json({ message: "Please upload a resume or provide self description." })
    }

    let resumeText = ""
    if (resumeFile) {
        try {
            resumeText = await extractResumeTextFromUpload(resumeFile)
        } catch (error) {
            return res.status(400).json({ message: error.message || "Unable to parse uploaded resume." })
        }
    }

    let interViewReportByAi
    try {
        interViewReportByAi = await generateInterviewReport({
            resume: resumeText,
            selfDescription,
            jobDescription
        })
    } catch (error) {
        console.error("[InterviewReport] AI generation failed, using fallback.", error)
        interViewReportByAi = buildFallbackInterviewReport({ jobDescription })
    }

    if (!interViewReportByAi?.title) {
        interViewReportByAi = {
            ...interViewReportByAi,
            title: deriveTitleFromJobDescription(jobDescription)
        }
    }

    const interviewReport = await interviewReportModel.create({
        user: req.user.id,
        resume: resumeText,
        selfDescription,
        jobDescription,
        ...interViewReportByAi
    })

    res.status(201).json({
        message: "Interview report generated successfully.",
        interviewReport
    })
}


/**
 * @description Get interview report by ID.
 */
async function getInterviewReportByIdController(req, res) {
    const { interviewId } = req.params
    const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })

    if (!interviewReport) {
        return res.status(404).json({ message: "Interview report not found." })
    }

    res.status(200).json({
        message: "Interview report fetched successfully.",
        interviewReport
    })
}


/**
 * @description Get insights (topSkills + criticalGaps) for a report.
 */
async function getInterviewInsightsController(req, res) {
    const { interviewId } = req.params
    const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })

    if (!interviewReport) {
        return res.status(404).json({ message: "Interview report not found." })
    }

    const { topSkills, criticalGaps } = extractInsights({
        topSkills: interviewReport.topSkills,
        skillGaps: interviewReport.skillGaps
    })

    res.status(200).json({
        message: "Interview insights fetched successfully.",
        topSkills,
        criticalGaps
    })
}


/**
 * @description Get all interview reports of the logged-in user.
 */
async function getAllInterviewReportsController(req, res) {
    const interviewReports = await interviewReportModel
        .find({ user: req.user.id })
        .sort({ createdAt: -1 })
        .select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan -resumePdfCache")

    res.status(200).json({
        message: "Interview reports fetched successfully.",
        interviewReports
    })
}


/**
 * @description Delete interview report by ID.
 */
async function deleteInterviewReportController(req, res) {
    const { interviewId } = req.params

    const deleted = await interviewReportModel.findOneAndDelete({
        _id: interviewId,
        user: req.user.id
    })

    if (!deleted) {
        return res.status(404).json({ message: "Interview report not found." })
    }

    return res.status(200).json({ message: "Interview report deleted successfully." })
}


/**
 * @description Generate (or return cached) resume PDF for an interview report.
 *
 * Cache logic:
 *   Computes SHA-256 of (resume text + jobDescription + sorted topSkills).
 *   Hash MATCH  → return stored Buffer, skip AI + Puppeteer entirely.
 *   Hash MISS   → call AI to generate structured data, render template,
 *                 convert to PDF, persist buffer + new hash on the report.
 *
 *   Skills check: AI identifies skills in the JD that are missing from the
 *   candidate's existing skills and injects them (no duplicates).
 */
async function generateResumePdfController(req, res) {
    const { interviewReportId } = req.params

    const interviewReport = await interviewReportModel.findOne({
        _id: interviewReportId,
        user: req.user.id
    })

    if (!interviewReport) {
        return res.status(404).json({ message: "Interview report not found." })
    }

    const { resume, jobDescription, selfDescription, topSkills } = interviewReport

    /* ── Build stable cache key ──────────────────────────────────
       Sort topSkills so order changes don't bust the cache.
       selfDescription is intentionally excluded — resume + JD define the output.
    ─────────────────────────────────────────────────────────── */
    const sortedSkills = [...(topSkills || [])].sort().join("|")
    const rawKey = `${resume || ""}__${jobDescription || ""}__${sortedSkills}`
    const currentHash = crypto.createHash("sha256").update(rawKey).digest("hex")

    /* ── Cache HIT ─────────────────────────────────────────────── */
    if (
        interviewReport.resumeInputHash === currentHash &&
        interviewReport.resumePdfCache &&
        interviewReport.resumePdfCache.length > 0
    ) {
        console.log(`[ResumeBuilder] Cache HIT — report ${interviewReportId}`)
        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`,
            "X-Cache": "HIT"
        })
        return res.send(interviewReport.resumePdfCache)
    }

    /* ── Cache MISS: generate fresh PDF ────────────────────────── */
    console.log(`[ResumeBuilder] Cache MISS — generating PDF for report ${interviewReportId}`)

    let pdfBuffer
    try {
        pdfBuffer = await generateResumePdf({ resume, jobDescription, selfDescription })
    } catch (error) {
        console.error("[ResumeBuilder] AI PDF generation failed, using fallback.", error)
        const fallbackHtml = buildFallbackResumeHtml({
            resume,
            selfDescription,
            jobDescription,
            title: interviewReport.title || deriveTitleFromJobDescription(jobDescription)
        })
        pdfBuffer = await generatePdfFromHtml(fallbackHtml)
    }

    /* Persist asynchronously so we don't slow down the response */
    interviewReportModel.findByIdAndUpdate(interviewReportId, {
        resumePdfCache: pdfBuffer,
        resumeInputHash: currentHash
    }).catch(err => console.error("[ResumeBuilder] Failed to cache PDF:", err))

    res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`,
        "X-Cache": "MISS"
    })
    res.send(pdfBuffer)
}


/**
 * @description Get aggregated dashboard stats for radar chart.
 */
async function getDashboardStatsController(req, res) {
    const reports = await interviewReportModel
        .find({ user: req.user.id })
        .select("topSkills skillGaps")
        .sort({ createdAt: -1 })
        .limit(10)

    const strengthsFrequency = {}
    const gapsFrequency = {}

    reports.forEach(report => {
        ;(report.topSkills || []).forEach(skill => {
            const name = typeof skill === "string" ? skill : (skill.skill || skill.name)
            if (name) strengthsFrequency[name] = (strengthsFrequency[name] || 0) + 1
        })
        ;(report.skillGaps || []).forEach(gap => {
            const name = typeof gap === "string" ? gap : (gap.skill || gap.name)
            if (name) gapsFrequency[name] = (gapsFrequency[name] || 0) + 1
        })
    })

    const topStrengths = Object.entries(strengthsFrequency)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)

    const recurringGaps = Object.entries(gapsFrequency)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)

    res.status(200).json({
        message: "Dashboard stats fetched.",
        radarData: { topStrengths, recurringGaps, totalAnalyzed: reports.length }
    })
}

module.exports = {
    generateInterViewReportController,
    getInterviewReportByIdController,
    getInterviewInsightsController,
    getAllInterviewReportsController,
    deleteInterviewReportController,
    generateResumePdfController,
    getDashboardStatsController
}
