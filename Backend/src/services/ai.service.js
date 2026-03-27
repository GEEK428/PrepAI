const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
const { zodToJsonSchema } = require("zod-to-json-schema")
const puppeteer = require("puppeteer")

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
})

const DEFAULT_MODEL_CANDIDATES = [
    process.env.GOOGLE_GENAI_MODEL,
    "gemini-2.5-flash",
    "gemini-2.0-flash"
].filter(Boolean)

function extractResponseText(response) {
    if (!response) return ""

    if (typeof response.text === "string") {
        return response.text
    }

    if (typeof response.text === "function") {
        try {
            return response.text() || ""
        } catch (err) {
            return ""
        }
    }

    return (
        response?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("") ||
        ""
    )
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

    let lastError = null

    for (const model of DEFAULT_MODEL_CANDIDATES) {
        try {
            const response = await ai.models.generateContent({
                model,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: zodToJsonSchema(schema),
                }
            })

            const rawText = extractResponseText(response)
            const parsed = safeParseJson(rawText)
            return schema.parse(parsed)
        } catch (err) {
            lastError = err
        }
    }

    throw lastError || new Error("Unable to generate AI response.")
}


const interviewReportSchema = z.object({
    matchScore: z.number().describe("A score between 0 and 100 indicating how well the candidate's profile matches the job description"),
    technicalQuestions: z.array(z.object({
        question:  z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer:    z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Technical questions that can be asked in the interview along with their intention and how to answer them"),
    behavioralQuestions: z.array(z.object({
        question:  z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer:    z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Behavioral questions that can be asked in the interview along with their intention and how to answer them"),
    skillGaps: z.array(z.object({
        skill:    z.string().describe("The skill which the candidate is lacking"),
        severity: z.enum(["low", "medium", "high"]).describe("The severity of this skill gap")
    })).describe("List of skill gaps in the candidate's profile along with their severity"),
    topSkills: z.array(z.string()).describe("Top 3-6 skills where candidate profile strongly matches the job description"),
    preparationPlan: z.array(z.object({
        day:   z.number().describe("The day number in the preparation plan, starting from 1"),
        focus: z.string().describe("The main focus of this day in the preparation plan"),
        tasks: z.array(z.string()).describe("List of tasks to be done on this day")
    })).describe("A day-wise preparation plan for the candidate"),
    title: z.string().describe("The title of the job for which the interview report is generated"),
})

const noteAnswerSchema = z.object({
    answerText: z.string().describe("Clear interview-ready answer in plain text with headings and bullet points where useful."),
    answerHtml: z.string().describe("Equivalent HTML answer using simple tags (p, ul, ol, li, strong, em, pre, code).")
})

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {
    const prompt = `Generate an interview report for a candidate with the following details:
Resume: ${resume}
Self Description: ${selfDescription}
Job Description: ${jobDescription}
Return topSkills as 3 to 6 concise skill names that best match this job description.
`
    return generateStructuredJson({
        prompt,
        schema: interviewReportSchema
    })
}


/* ═══════════════════════════════════════════════════════════════════
   RESUME STRUCTURED DATA SCHEMA
   AI extracts structured data, then we render into a fixed template.
═══════════════════════════════════════════════════════════════════ */
const resumeDataSchema = z.object({
    name:     z.string().describe("Full name of the candidate"),
    email:    z.string().describe("Email address, empty string if not found"),
    phone:    z.string().describe("Phone number, empty string if not found"),
    linkedin: z.string().describe("LinkedIn profile URL or username, empty string if not found"),
    github:   z.string().describe("GitHub profile URL or username, empty string if not found"),
    leetcode: z.string().describe("LeetCode profile URL or username, empty string if not found"),
    portfolio:z.string().describe("Portfolio or personal website URL, empty string if not found"),

    education: z.array(z.object({
        institution: z.string().describe("Name of the college, university or school"),
        degree:      z.string().describe("Degree and field of study, e.g. B.Tech Computer Science"),
        years:       z.string().describe("Year range, e.g. 2020 – 2024 or 2024"),
        gpa:         z.string().describe("GPA or percentage if mentioned, empty string otherwise")
    })).describe("Education history, most recent first"),

    skills: z.array(z.object({
        category: z.string().describe("Skill category label, e.g. Languages, Frameworks, Tools, Databases"),
        items:    z.array(z.string()).describe("List of skills in this category")
    })).describe("Skills grouped by category"),

    projects: z.array(z.object({
        name:        z.string().describe("Project name"),
        description: z.string().describe("One to two sentence description of the project and its impact. Include a quantified metric if available, e.g. reduced latency by 40%, used by 500+ users."),
        techStack:   z.array(z.string()).describe("Technologies used in this project"),
        link:        z.string().describe("Project URL or GitHub link if available, empty string otherwise")
    })).describe("Projects the candidate has built, most impressive first, max 4"),

    experience: z.array(z.object({
        company:     z.string().describe("Company or organization name"),
        role:        z.string().describe("Job title or role"),
        duration:    z.string().describe("Duration, e.g. Jun 2023 – Aug 2023"),
        bullets:     z.array(z.string()).describe("2-3 achievement-focused bullet points with quantified impact where possible")
    })).describe("Work experience, internships, most recent first, max 3"),

    achievements: z.array(z.string()).describe("Awards, certifications, competitive programming ranks, open source contributions – max 4 items"),

    /* Skills to ADD from job description that are NOT already present */
    missingJobSkills: z.array(z.string()).describe("Skills explicitly required in the job description that are NOT in the candidate's existing skills list. Max 6. Only add if genuinely missing.")
})

/* ═══════════════════════════════════════════════════════════════════
   LATEX-INSPIRED HTML TEMPLATE
   Fixed structure: Name → Links → Education → Skills → Projects
                    → Experience → Achievements
   Always 1 A4 page, ultra-compact, professional.
═══════════════════════════════════════════════════════════════════ */
function buildResumeHtml(data) {
    const { name, email, phone, linkedin, github, leetcode, portfolio,
            education, skills, projects, experience, achievements } = data

    /* ── helpers ── */
    const esc = (s) => (s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    const linkTag = (label, url) => {
        if (!url) return ""
        const href = url.startsWith("http") ? url : `https://${url}`
        return `<a href="${esc(href)}" style="color:#111;text-decoration:none;">${esc(label || url)}</a>`
    }

    const contactParts = [
        email    ? `<a href="mailto:${esc(email)}" style="color:#111;text-decoration:none;">${esc(email)}</a>` : "",
        phone    ? esc(phone)    : "",
        linkedin ? linkTag("LinkedIn", linkedin) : "",
        github   ? linkTag("GitHub",   github)   : "",
        leetcode ? linkTag("LeetCode", leetcode) : "",
        portfolio? linkTag("Portfolio",portfolio) : ""
    ].filter(Boolean)

    const hr = `<hr style="border:none;border-top:1px solid #222;margin:3pt 0 2pt;">`

    /* ── education ── */
    const eduHtml = (education || []).map(e => `
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:1pt;">
            <span><b>${esc(e.institution)}</b> — <span style="font-style:italic;">${esc(e.degree)}</span>${e.gpa ? ` • GPA: ${esc(e.gpa)}` : ""}</span>
            <span style="white-space:nowrap;font-size:7pt;color:#444;">${esc(e.years)}</span>
        </div>`).join("")

    /* ── skills ── */
    const skillsHtml = (skills || []).map(s =>
        `<span><b>${esc(s.category)}:</b> ${s.items.map(esc).join(", ")}</span>`
    ).join(" &nbsp;|&nbsp; ")

    /* ── projects ── */
    const projHtml = (projects || []).slice(0,4).map(p => {
        const techStr = (p.techStack || []).length ? `<span style="font-style:italic;color:#444;">${p.techStack.map(esc).join(", ")}</span>` : ""
        const lnk = p.link ? ` <a href="${p.link.startsWith("http")?p.link:"https://"+p.link}" style="color:#333;font-size:6.5pt;">[link]</a>` : ""
        return `
        <div style="margin-bottom:3pt;">
            <div style="display:flex;justify-content:space-between;align-items:baseline;">
                <b>${esc(p.name)}${lnk}</b> ${techStr}
            </div>
            <div style="margin-left:8pt;">${esc(p.description)}</div>
        </div>`
    }).join("")

    /* ── experience ── */
    const expHtml = (experience || []).slice(0,3).map(e => `
        <div style="margin-bottom:3pt;">
            <div style="display:flex;justify-content:space-between;align-items:baseline;">
                <span><b>${esc(e.role)}</b> — <i>${esc(e.company)}</i></span>
                <span style="white-space:nowrap;font-size:7pt;color:#444;">${esc(e.duration)}</span>
            </div>
            <ul style="margin:1pt 0 0 12pt;padding:0;">${(e.bullets||[]).map(b=>`<li>${esc(b)}</li>`).join("")}</ul>
        </div>`).join("")

    /* ── achievements ── */
    const achHtml = (achievements || []).slice(0,4)
        .map(a => `<li>${esc(a)}</li>`).join("")

    const sectionTitle = (t) =>
        `<div style="font-size:8pt;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;border-bottom:0.8pt solid #111;margin:4pt 0 2pt;">${t}</div>`

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  @page { size: A4; margin: 10mm 12mm; }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 8.5pt;
    line-height: 1.25;
    color: #111;
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact;
  }
  a { color: #111; text-decoration: none; }
  ul { margin: 0; padding-left: 12pt; }
  li { margin-bottom: 1pt; }
  b { font-weight: 700; }
</style>
</head>
<body>
<!-- NAME -->
<div style="text-align:center;margin-bottom:2pt;">
    <div style="font-size:18pt;font-weight:700;letter-spacing:0.02em;">${esc(name)}</div>
    <div style="font-size:7.5pt;margin-top:2pt;color:#222;">
        ${contactParts.join(" &nbsp;•&nbsp; ")}
    </div>
</div>

${hr}

${education?.length ? sectionTitle("Education") + eduHtml : ""}

${skills?.length ? sectionTitle("Skills") + `<div style="font-size:7.8pt;line-height:1.4;">${skillsHtml}</div>` : ""}

${projects?.length ? sectionTitle("Projects") + projHtml : ""}

${experience?.length ? sectionTitle("Experience") + expHtml : ""}

${achievements?.length ? sectionTitle("Achievements") + `<ul style="margin:0 0 0 12pt;">${achHtml}</ul>` : ""}

</body>
</html>`
}


async function generatePdfFromHtml(htmlContent) {
    let browser;
    try {
        browser = await puppeteer.launch({
            executablePath: process.env.NODE_ENV === "production" ? "/usr/bin/chromium" : undefined,
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--single-process"],
            headless: "new"
        });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: "networkidle0" });
        const pdfBuffer = await page.pdf({
            format: "A4",
            margin: { top: "10mm", bottom: "10mm", left: "12mm", right: "12mm" },
            printBackground: true
        });
        return pdfBuffer;
    } finally {
        if (browser) await browser.close();
    }
}


/* ═══════════════════════════════════════════════════════════════
   MAIN EXPORT: generateResumePdf
   1. Ask AI to extract structured data from resume / self-desc
   2. AI identifies missing skills from job description
   3. Inject missing skills into the skills sections
   4. Render fixed LaTeX-style HTML template
   5. Convert to PDF via Puppeteer
═══════════════════════════════════════════════════════════════ */
async function generateResumePdf({ resume, selfDescription, jobDescription }) {

    const prompt = `You are a professional resume parser and optimizer.

Extract all information from the candidate data below into the structured schema.

CANDIDATE DATA:
Resume Text: ${resume || "(none)"}
Self Description: ${selfDescription || "(none)"}
Job Description: ${jobDescription}

RULES:
1. Do NOT invent or hallucinate ANY detail. Only use facts from the data above.
2. For projects: add a realistic quantified metric to the description if one can be reasonably inferred (e.g. "built for 200+ users", "reduced API calls by ~30%"). Do NOT fabricate specific numbers not implied by the text.
3. For experience bullet points: make them achievement-focused and concise.
4. In missingJobSkills: list ONLY skills the job description explicitly requires that are NOT already in the candidate's skills. Max 6. Keep them concise (e.g. "Docker", "GraphQL").
5. Keep all text tight and concise — this must fit on one A4 page.`

    const data = await generateStructuredJson({
        prompt,
        schema: resumeDataSchema
    })

    /* ── Inject missing skills into the Skills section ── */
    if (data.missingJobSkills && data.missingJobSkills.length > 0) {
        const allExisting = (data.skills || []).flatMap(s => s.items.map(i => i.toLowerCase()))
        const toAdd = data.missingJobSkills.filter(s => !allExisting.includes(s.toLowerCase()))

        if (toAdd.length > 0) {
            // Try to find a "Tools" or "Other" category to append to, else create one
            const targetCat = data.skills.find(s =>
                /tools?|other|misc|additional/i.test(s.category)
            )
            if (targetCat) {
                targetCat.items = [...targetCat.items, ...toAdd]
            } else {
                data.skills.push({ category: "Additional", items: toAdd })
            }
        }
    }

    const html = buildResumeHtml(data)
    const pdfBuffer = await generatePdfFromHtml(html)
    return pdfBuffer
}


async function generateNoteAnswer({ domain, subdomain, question, sourceTag = "", difficulty = "medium" }) {
    const prompt = `
Generate a concise but strong interview answer for this question.

Domain: ${domain}
Subdomain: ${subdomain}
Difficulty: ${difficulty}
Source: ${sourceTag || "N/A"}
Question: ${question}

Instructions:
- Keep it practical and interviewer-ready.
- Use clear structure: key idea, approach, examples, common mistakes.
- If coding-related, include short pseudocode/code-style explanation.
- Avoid very long output.
- Return both answerText and answerHtml.
`
    return generateStructuredJson({
        prompt,
        schema: noteAnswerSchema
    })
}

module.exports = { generateInterviewReport, generateResumePdf, generatePdfFromHtml, generateNoteAnswer }
