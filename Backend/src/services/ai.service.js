const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
const { zodToJsonSchema } = require("zod-to-json-schema")
const puppeteer = require("puppeteer")

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
})

const RESUME_AI_MODEL = "gemini-3-flash-preview"

function extractResponseText(response) {
    if (!response) return ""

    if (typeof response.text === "string") return response.text

    if (typeof response.text === "function") {
        try {
            return response.text() || ""
        } catch (err) {
            return ""
        }
    }

    return response?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("") || ""
}

function safeParseJson(rawText = "") {
    const text = String(rawText || "").trim()
    if (!text) {
        throw new Error("AI returned an empty response.")
    }

    try {
        return JSON.parse(text)
    } catch (err) {
        const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
        if (fenced?.[1]) {
            return JSON.parse(fenced[1].trim())
        }
        throw new Error("AI returned malformed JSON.")
    }
}

async function generateStructuredJson({ prompt, schema }) {
    if (!process.env.GOOGLE_GENAI_API_KEY) {
        throw new Error("GOOGLE_GENAI_API_KEY is missing.")
    }

    const response = await ai.models.generateContent({
        model: RESUME_AI_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(schema),
        }
    })

    const rawText = extractResponseText(response)
    const parsed = safeParseJson(rawText)
    return schema.parse(parsed)
}

const interviewReportSchema = z.object({
    matchScore: z.number().describe("A score between 0 and 100 indicating how well the candidate profile matches the job description"),
    technicalQuestions: z.array(z.object({
        question: z.string(),
        intention: z.string(),
        answer: z.string()
    })),
    behavioralQuestions: z.array(z.object({
        question: z.string(),
        intention: z.string(),
        answer: z.string()
    })),
    skillGaps: z.array(z.object({
        skill: z.string(),
        severity: z.enum(["low", "medium", "high"])
    })),
    topSkills: z.array(z.string()),
    preparationPlan: z.array(z.object({
        day: z.number(),
        focus: z.string(),
        tasks: z.array(z.string())
    })),
    title: z.string(),
})

const noteAnswerSchema = z.object({
    answerText: z.string(),
    answerHtml: z.string()
})

const jobSkillsSchema = z.object({
    requiredSkills: z.array(z.string())
})

const onePageResumeSchema = z.object({
    resumeText: z.string()
})

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {
    const prompt = `Generate an interview report for a candidate with the following details:\nResume: ${resume}\nSelf Description: ${selfDescription}\nJob Description: ${jobDescription}\nReturn topSkills as 3 to 6 concise skill names that best match this job description.`

    return generateStructuredJson({
        prompt,
        schema: interviewReportSchema
    })
}

function normalizeSkillName(skill = "") {
    return String(skill || "").trim().replace(/[.,;:]+$/g, "")
}

function dedupeSkills(skills = []) {
    const seen = new Set()
    const out = []
    for (const raw of skills) {
        const skill = normalizeSkillName(raw)
        if (!skill) continue
        const key = skill.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push(skill)
    }
    return out
}

function extractPresentSkillsFromText(resumeText = "") {
    const text = String(resumeText || "")
    const parts = text.split(/[\n,|]/g).map((item) => normalizeSkillName(item)).filter(Boolean)
    return dedupeSkills(parts)
}

function injectMissingSkillsIntoResumeText(resumeText = "", requiredSkills = []) {
    const text = String(resumeText || "").trim()
    const lines = text.split(/\r?\n/)

    const existingSkills = extractPresentSkillsFromText(text).map((s) => s.toLowerCase())
    const missing = dedupeSkills(requiredSkills).filter((skill) => !existingSkills.includes(skill.toLowerCase()))

    if (!missing.length) {
        return text
    }

    const headingRegex = /^\s*(skills?|technical skills?|core skills?|technologies?)\s*:?\s*$/i
    const headingIndex = lines.findIndex((line) => headingRegex.test(line.trim()))

    if (headingIndex >= 0) {
        let insertAt = headingIndex + 1
        while (
            insertAt < lines.length &&
            lines[insertAt].trim() &&
            !/^[A-Z][A-Za-z\s/&-]{2,35}:?$/.test(lines[insertAt].trim())
        ) {
            insertAt += 1
        }
        lines.splice(insertAt, 0, `Added for target role: ${missing.join(", ")}`)
        return lines.join("\n").trim()
    }

    return `${text}\n\nSkills\n${missing.join(", ")}`.trim()
}

function isLikelyOnePageResume(resumeText = "") {
    const words = String(resumeText || "").split(/\s+/).filter(Boolean).length
    const lines = String(resumeText || "").split(/\r?\n/).filter((line) => line.trim()).length
    return words <= 650 && lines <= 90
}

function escapeHtml(text = "") {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
}

function buildBasicResumeHtmlFromText(resumeText = "") {
    const lines = String(resumeText || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)

    const content = lines.map((line) => {
        const isHeading = /^[A-Z][A-Za-z\s/&-]{2,40}:?$/.test(line)
        const isBullet = /^[-*•]\s+/.test(line)

        if (isHeading) {
            return `<h2>${escapeHtml(line.replace(/:$/, ""))}</h2>`
        }
        if (isBullet) {
            return `<p class=\"bullet\">${escapeHtml(line.replace(/^[-*•]\s+/, ""))}</p>`
        }
        return `<p>${escapeHtml(line)}</p>`
    }).join("\n")

    return `<!DOCTYPE html>
<html>
<head>
<meta charset=\"UTF-8\">
<style>
  @page { size: A4; margin: 10mm; }
  body {
    font-family: Arial, sans-serif;
    font-size: 9pt;
    line-height: 1.28;
    color: #111;
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact;
  }
  h2 {
    font-size: 10pt;
    margin: 8pt 0 3pt;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 1px solid #222;
    padding-bottom: 2pt;
  }
  p {
    margin: 2pt 0;
    white-space: pre-wrap;
    word-break: break-word;
  }
  p.bullet {
    padding-left: 10pt;
    text-indent: -8pt;
  }
</style>
</head>
<body>
${content}
</body>
</html>`
}

async function extractRequiredSkillsFromJobDescription(jobDescription = "") {
    const prompt = `Extract required technical/job skills from this job description.\n\nJob Description:\n${jobDescription}\n\nRules:\n1. Return concise skill names only.\n2. No explanations.\n3. Prefer concrete technologies/frameworks/tools over soft skills.\n4. Maximum 12 skills.`

    const response = await generateStructuredJson({
        prompt,
        schema: jobSkillsSchema
    })

    return dedupeSkills(response?.requiredSkills || []).slice(0, 12)
}

async function condenseResumeToOnePage({ resumeText, requiredSkills, jobDescription }) {
    const prompt = `Rewrite this resume to one page while preserving factual content.\n\nResume Text:\n${resumeText}\n\nRequired Job Skills:\n${requiredSkills.join(", ") || "(none)"}\n\nJob Description:\n${jobDescription}\n\nRules:\n1. Do not invent any facts, dates, companies, projects, or metrics.\n2. Keep core achievements and responsibilities.\n3. Keep or create a Skills section containing required skills.\n4. Use compact section headings and short bullets.\n5. Remove repetition and verbose lines only.`

    const response = await generateStructuredJson({
        prompt,
        schema: onePageResumeSchema
    })

    return String(response?.resumeText || "").trim()
}

async function generatePdfFromHtml(htmlContent) {
    let browser
    try {
        browser = await puppeteer.launch({
            executablePath: process.env.NODE_ENV === "production" ? "/usr/bin/chromium" : undefined,
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--single-process"],
            headless: "new"
        })
        const page = await browser.newPage()
        await page.setContent(htmlContent, { waitUntil: "networkidle0" })
        const pdfBuffer = await page.pdf({
            format: "A4",
            margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
            printBackground: true
        })
        return pdfBuffer
    } finally {
        if (browser) await browser.close()
    }
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {
    const sourceResumeText = String(resume || selfDescription || "").trim()
    if (!sourceResumeText) {
        throw new Error("Resume text is empty. Upload a valid resume to continue.")
    }

    const requiredSkills = await extractRequiredSkillsFromJobDescription(jobDescription || "")
    const resumeWithSkills = injectMissingSkillsIntoResumeText(sourceResumeText, requiredSkills)

    const finalResumeText = isLikelyOnePageResume(resumeWithSkills)
        ? resumeWithSkills
        : await condenseResumeToOnePage({
            resumeText: resumeWithSkills,
            requiredSkills,
            jobDescription: jobDescription || ""
        })

    const html = buildBasicResumeHtmlFromText(finalResumeText)
    return generatePdfFromHtml(html)
}

async function generateNoteAnswer({ domain, subdomain, question, sourceTag = "", difficulty = "medium" }) {
    const prompt = `Generate a concise but strong interview answer for this question.\n\nDomain: ${domain}\nSubdomain: ${subdomain}\nDifficulty: ${difficulty}\nSource: ${sourceTag || "N/A"}\nQuestion: ${question}\n\nInstructions:\n- Keep it practical and interviewer-ready.\n- Use clear structure: key idea, approach, examples, common mistakes.\n- If coding-related, include short pseudocode/code-style explanation.\n- Avoid very long output.\n- Return both answerText and answerHtml.`

    return generateStructuredJson({
        prompt,
        schema: noteAnswerSchema
    })
}

module.exports = {
    generateInterviewReport,
    generateResumePdf,
    generatePdfFromHtml,
    generateNoteAnswer
}
