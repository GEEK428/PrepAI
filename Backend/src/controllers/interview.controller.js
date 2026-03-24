const pdfParse = require("pdf-parse")
const mammoth = require("mammoth")
const WordExtractor = require("word-extractor")
const os = require("os")
const fs = require("fs/promises")
const path = require("path")
const { generateInterviewReport, generateResumePdf } = require("../services/ai.service")
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

async function extractResumeTextFromUpload(file) {
    const extension = path.extname(file?.originalname || "").toLowerCase()
    const mimeType = file?.mimetype || ""

    const isPdf = mimeType === "application/pdf" || extension === ".pdf"
    const isDocx = mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || extension === ".docx"
    const isDoc = mimeType === "application/msword" || extension === ".doc"

    if (isPdf) {
        const resumeContent = await (new pdfParse.PDFParse(Uint8Array.from(file.buffer))).getText()
        return (resumeContent.text || "").trim()
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
 * @description Controller to generate interview report based on user self description, resume and job description.
 */
async function generateInterViewReportController(req, res) {
    const { selfDescription, jobDescription } = req.body
    const resumeFile = req.file

    if (!jobDescription?.trim()) {
        return res.status(400).json({
            message: "Job description is required."
        })
    }

    if (!resumeFile && !selfDescription?.trim()) {
        return res.status(400).json({
            message: "Please upload a resume or provide self description."
        })
    }

    let resumeText = ""

    if (resumeFile) {
        try {
            resumeText = await extractResumeTextFromUpload(resumeFile)
        } catch (error) {
            return res.status(400).json({
                message: error.message || "Unable to parse uploaded resume."
            })
        }
    }

    const interViewReportByAi = await generateInterviewReport({
        resume: resumeText,
        selfDescription,
        jobDescription
    })

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
 * @description Controller to get interview report by interviewId.
 */
async function getInterviewReportByIdController(req, res) {

    const { interviewId } = req.params

    const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    res.status(200).json({
        message: "Interview report fetched successfully.",
        interviewReport
    })
}

/**
 * @description Controller to get insights for a specific interview report.
 */
async function getInterviewInsightsController(req, res) {
    const { interviewId } = req.params

    const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
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
 * @description Controller to get all interview reports of logged in user.
 */
async function getAllInterviewReportsController(req, res) {
    const interviewReports = await interviewReportModel.find({ user: req.user.id }).sort({ createdAt: -1 }).select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan")

    res.status(200).json({
        message: "Interview reports fetched successfully.",
        interviewReports
    })
}

/**
 * @description Controller to delete interview report by interviewId.
 */
async function deleteInterviewReportController(req, res) {
    const { interviewId } = req.params

    const deleted = await interviewReportModel.findOneAndDelete({
        _id: interviewId,
        user: req.user.id
    })

    if (!deleted) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    return res.status(200).json({
        message: "Interview report deleted successfully."
    })
}


/**
 * @description Controller to generate resume PDF based on user self description, resume and job description.
 */
async function generateResumePdfController(req, res) {
    const { interviewReportId } = req.params

    const interviewReport = await interviewReportModel.findById(interviewReportId)

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    const { resume, jobDescription, selfDescription } = interviewReport

    const pdfBuffer = await generateResumePdf({ resume, jobDescription, selfDescription })

    res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
    })

    res.send(pdfBuffer)
}

/**
 * @description Controller to get aggregated dashboard stats for radar chart
 */
async function getDashboardStatsController(req, res) {
    const reports = await interviewReportModel.find({ user: req.user.id })
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
