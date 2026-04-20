const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
const { zodToJsonSchema } = require("zod-to-json-schema")
const crypto = require("crypto")
const { getCache, setCache } = require("../utils/redis")
let puppeteerLib = null

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
})

const RESUME_AI_MODEL = "gemini-1.5-flash"

function generateCacheKey(prefix, data) {
    const hash = crypto.createHash("md5").update(JSON.stringify(data)).digest("hex")
    return `${prefix}:${hash}`
}

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
    if (!text) throw new Error("AI returned an empty response.")
    try {
        return JSON.parse(text)
    } catch (err) {
        const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
        if (fenced?.[1]) return JSON.parse(fenced[1].trim())
        throw new Error("AI returned malformed JSON.")
    }
}

async function generateStructuredJson({ prompt, schema, cachePrefix = null, cacheData = null }) {
    // 1. Check Redis Cache first
    let cacheKey = null
    if (cachePrefix && cacheData) {
        cacheKey = generateCacheKey(cachePrefix, cacheData)
        const cached = await getCache(cacheKey)
        if (cached) {
            console.log(`[AI-Cache] HIT: ${cacheKey}`)
            return cached
        }
    }

    if (!process.env.GOOGLE_GENAI_API_KEY) throw new Error("GOOGLE_GENAI_API_KEY is missing.")
    
    console.log(`[AI-Cache] MISS: Calling Gemini for prompt...`)
    const response = await ai.getGenerativeModel({ model: RESUME_AI_MODEL }).generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(schema),
        }
    })
    
    const rawText = extractResponseText(response.response)
    const parsed = safeParseJson(rawText)
    const validated = schema.parse(parsed)

    // 2. Save to Redis for future hits
    if (cacheKey) {
        await setCache(cacheKey, validated, 43200) // Cache for 12 hours
    }

    return validated
}

const interviewReportSchema = z.object({
    matchScore: z.number(),
    technicalQuestions: z.array(z.object({ question: z.string(), intention: z.string(), answer: z.string() })),
    behavioralQuestions: z.array(z.object({ question: z.string(), intention: z.string(), answer: z.string() })),
    skillGaps: z.array(z.object({ skill: z.string(), severity: z.enum(["low", "medium", "high"]) })),
    topSkills: z.array(z.string()),
    preparationPlan: z.array(z.object({ day: z.number(), focus: z.string(), tasks: z.array(z.string()) })),
    title: z.string(),
})

const noteAnswerSchema = z.object({
    answerText: z.string(),
    answerHtml: z.string()
})

const premiumResumeSchema = z.object({
    header: z.object({
        fullName: z.string(),
        email: z.string(),
        phone: z.string(),
        location: z.string(),
        links: z.array(z.object({ label: z.string(), url: z.string() })).default([])
    }),
    education: z.array(z.object({
        institution: z.string(),
        degree: z.string(),
        duration: z.string(),
        location: z.string(),
        details: z.array(z.string()).optional()
    })),
    experience: z.array(z.object({
        company: z.string(),
        role: z.string(),
        duration: z.string(),
        location: z.string(),
        points: z.array(z.string())
    })).default([]),
    projects: z.array(z.object({
        title: z.string(),
        techStack: z.string().optional(),
        duration: z.string(),
        link: z.string().optional(),
        points: z.array(z.string())
    })).default([]),
    technicalSkills: z.array(z.object({
        category: z.string(),
        skills: z.string()
    })),
    achievements: z.array(z.string()).default([]),
    interests: z.array(z.string()).default([])
})

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {
    const prompt = `Generate a high-quality, comprehensive interview analysis report.
Job Context: ${jobDescription}
Candidate Details: ${resume} ${selfDescription}

Requirements:
1. Calculate a realistic matchScore (0-100).
2. Generate EXACTLY 4 technical questions tailored to the role.
3. Generate EXACTLY 4 behavioral questions.
4. Provide a PROPER 7-day preparation plan.
5. Identify skill gaps and top skills accurately.`

    return generateStructuredJson({ 
        prompt, 
        schema: interviewReportSchema, 
        cachePrefix: "report", 
        cacheData: { resume, selfDescription, jobDescription } 
    })
}

function escapeHtml(text = "") {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function buildPremiumResumeHtml(data) {
    const { header, education, experience, projects, technicalSkills, achievements, interests } = data;
    const linksHtml = (header.links || []).map(link => `<a href="${link.url}">${link.label}</a>`).join(" | ");

    const escape = (t) => escapeHtml(t);

    const section = (title, content) => content ? `
        <div class="section">
            <h2 class="section-title">${title}</h2>
            <div class="section-content">${content}</div>
        </div>` : "";

    const educationHtml = (education || []).map(edu => `
        <div class="entry">
            <div class="entry-header">
                <span class="bold">${escape(edu.institution)}</span>
                <span class="bold right">${escape(edu.duration)}</span>
            </div>
            <div class="entry-subheader">
                <span class="italic">${escape(edu.degree)}</span>
                <span class="italic right">${escape(edu.location)}</span>
            </div>
            ${edu.details?.length ? `<ul>${edu.details.map(d => `<li>${escape(d)}</li>`).join("")}</ul>` : ""}
        </div>`).join("");

    const experienceHtml = (experience || []).map(exp => `
        <div class="entry">
            <div class="entry-header">
                <span class="bold">${escape(exp.company)}</span>
                <span class="bold right">${escape(exp.duration)}</span>
            </div>
            <div class="entry-subheader">
                <span class="italic">${escape(exp.role)}</span>
                <span class="italic right">${escape(exp.location)}</span>
            </div>
            <ul>${exp.points.map(p => `<li>${escape(p)}</li>`).join("")}</ul>
        </div>`).join("");

    const projectsHtml = (projects || []).map(proj => `
        <div class="entry">
            <div class="entry-header">
                <span class="bold">${escape(proj.title)} ${proj.techStack ? `| <span class="normal">${escape(proj.techStack)}</span>` : ""}</span>
                <span class="bold right">${escape(proj.duration)} ${proj.link ? `| <a href="${proj.link}">Link</a>` : ""}</span>
            </div>
            <ul>${proj.points.map(p => `<li>${escape(p)}</li>`).join("")}</ul>
        </div>`).join("");

    const skillsHtml = (technicalSkills || []).map(s => `
        <p><strong>${escape(s.category)}:</strong> ${escape(s.skills)}</p>
    `).join("");

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @page { size: A4; margin: 0.5in; }
        body { 
            font-family: "Times New Roman", Times, serif; 
            font-size: 10.5pt; 
            line-height: 1.2; 
            color: #000; 
            margin: 0; 
            padding: 0;
        }
        .container { width: 100%; }
        header { text-align: center; margin-bottom: 5pt; }
        header h1 { font-size: 26pt; margin: 0; font-weight: normal; }
        header p { margin: 2pt 0; font-size: 10pt; }
        header .links { margin-top: 2pt; }
        header a { color: #000; text-decoration: underline; margin: 0 3pt; font-size: 10pt; }
        
        .section { margin-top: 10pt; }
        .section-title { 
            font-size: 11pt; 
            font-weight: bold; 
            text-transform: uppercase; 
            border-bottom: 1.5pt solid #000; 
            margin: 0 0 4pt; 
            padding-bottom: 1pt; 
        }
        
        .entry { margin-bottom: 6pt; }
        .entry-header, .entry-subheader { 
            display: flex; 
            justify-content: space-between; 
            align-items: baseline; 
        }
        .bold { font-weight: bold; }
        .italic { font-style: italic; }
        .normal { font-weight: normal; }
        .right { text-align: right; }
        
        ul { margin: 2pt 0 0 16pt; padding: 0; list-style-type: disc; }
        li { margin-bottom: 1pt; text-align: justify; }
        p { margin: 2pt 0; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>${escape(header.fullName)}</h1>
            <p>${escape(header.location)} | ${escape(header.phone)} | ${escape(header.email)}</p>
            <div class="links">${linksHtml}</div>
        </header>

        ${section("EDUCATION", educationHtml)}
        ${section("PROJECTS", projectsHtml)}
        ${section("TECHNICAL SKILLS", skillsHtml)}
        ${experience.length ? section("EXPERIENCE", experienceHtml) : ""}
        ${achievements.length ? section("ACHIEVEMENTS", "<ul>" + achievements.map(a => `<li>${escape(a)}</li>`).join("") + "</ul>") : ""}
        ${interests.length ? section("INTERESTS", "<ul><li>" + escape(interests.join(", ")) + "</li></ul>") : ""}
    </div>
</body>
</html>`;
    return html;
}

async function generatePdfFromHtml(htmlContent) {
    if (!puppeteerLib) puppeteerLib = require("puppeteer")
    let browser
    try {
        browser = await puppeteerLib.launch({
            executablePath: process.env.NODE_ENV === "production" ? "/usr/bin/chromium" : undefined,
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--single-process"],
            headless: "new"
        })
        const page = await browser.newPage()
        await page.setContent(htmlContent, { waitUntil: "networkidle0" })
        return await page.pdf({ format: "A4", margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" }, printBackground: true })
    } finally {
        if (browser) await browser.close()
    }
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {
    const source = String(resume || selfDescription || "").trim()
    if (!source) throw new Error("Resume content missing.")

    const prompt = "Convert this candidate profile into a high-quality professional resume JSON. \nJob context: " + (jobDescription || "N/A") + "\nProfile: " + source + "\n\nRules:\n1. Extract Details and all links.\n2. Standard Academic Order.\n3. STAR Method points.\n4. No inventions.";

    const data = await generateStructuredJson({ 
        prompt, 
        schema: premiumResumeSchema,
        cachePrefix: "resume-json",
        cacheData: { resume, selfDescription, jobDescription } 
    })
    return generatePdfFromHtml(buildPremiumResumeHtml(data))
}

async function generateNoteAnswer({ domain, subdomain, question, sourceTag = "" }) {
    const prompt = "Generate interview answer for: " + question + "\nDomain: " + domain;
    return generateStructuredJson({ 
        prompt, 
        schema: noteAnswerSchema,
        cachePrefix: "note",
        cacheData: { domain, subdomain, question }
    })
}

module.exports = { generateInterviewReport, generateResumePdf, generatePdfFromHtml, generateNoteAnswer }
