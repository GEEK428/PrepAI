require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");
const { z } = require("zod");
const { zodToJsonSchema } = require("zod-to-json-schema");
const crypto = require("crypto");
const { getCache, setCache } = require("../utils/redis");

const ensureAbsoluteUrl = (url) => {
    if (!url) return "";
    const s = url.trim();
    if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("mailto:") || s.startsWith("tel:")) {
        return s;
    }
    return `https://${s}`;
};
let puppeteerLib = null;

const RESUME_AI_MODEL = "gemini-3-flash-preview"; 

let aiInstance = null;
function getAi() {
    if (!aiInstance) {
        const key = process.env.GOOGLE_GENAI_API_KEY;
        if (!key) {
            console.error("[AI-Service] CRITICAL: GOOGLE_GENAI_API_KEY is not defined in environment.");
        }
        aiInstance = new GoogleGenAI({ apiKey: key });
    }
    return aiInstance;
}

function generateCacheKey(prefix, data) {
    const hash = crypto.createHash("md5").update(JSON.stringify(data)).digest("hex")
    return `${prefix}:${hash}`
}

function extractResponseText(response) {
    if (!response) return ""
    // Check if it's the result object directly (sometimes @google/genai returns this)
    if (typeof response.text === "string") return response.text
    if (typeof response.text === "function") return response.text()
    
    // Check candidates
    const candidates = response.candidates || response.result?.candidates
    if (candidates && candidates[0]) {
        const parts = candidates[0].content?.parts
        if (parts && parts[0]) return parts[0].text || ""
    }
    return ""
}

function safeParseJson(rawText = "") {
    const text = String(rawText || "").trim()
    if (!text) throw new Error("AI returned an empty response.")
    try {
        return JSON.parse(text)
    } catch (err) {
        // Handle common markdown artifacts like ```json or ```javascript
        const fenced = text.match(/```(?:\w+)?\s*([\s\S]*?)\s*```/i)
        if (fenced?.[1]) return JSON.parse(fenced[1].trim())
        throw new Error("AI returned malformed JSON: " + text.slice(0, 100));
    }
}

const FALLBACK_MODEL = "gemini-2.5-flash-preview-05-20";
const MAX_RETRIES = 3;

async function callAiWithRetry(prompt, schema) {
    const ai = getAi();
    const models = [RESUME_AI_MODEL, FALLBACK_MODEL];
    let lastError = null;

    for (const model of models) {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                console.log(`[AI-Service] Trying ${model} (attempt ${attempt}/${MAX_RETRIES})...`);
                const response = await ai.models.generateContent({
                    model,
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: "application/json",
                        responseSchema: zodToJsonSchema(schema),
                    }
                });

                const rawText = extractResponseText(response);
                if (!rawText) throw new Error("Empty response from AI model");
                console.log(`[AI-Service] Raw (${model}): ${rawText.slice(0, 150)}...`);

                const parsed = safeParseJson(rawText);
                const validated = schema.parse(parsed);
                console.log(`[AI-Service] Success with ${model} on attempt ${attempt}`);
                return validated;
            } catch (err) {
                lastError = err;
                const msg = err.message || "";
                const isRetryable = msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("overloaded") || msg.includes("high demand") || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED");
                console.warn(`[AI-Service] ${model} attempt ${attempt} failed: ${msg.slice(0, 120)}`);
                
                if (!isRetryable) break; // don't retry non-transient errors on this model
                if (attempt < MAX_RETRIES) {
                    const delay = attempt * 2000; // 2s, 4s
                    console.log(`[AI-Service] Waiting ${delay}ms before retry...`);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }
        console.log(`[AI-Service] All attempts exhausted for ${model}, trying next model...`);
    }

    throw lastError || new Error("All AI models failed.");
}

async function generateStructuredJson({ prompt, schema, cachePrefix = null, cacheData = null }) {
    try {
        // 1. Check Redis Cache first
        let cacheKey = null;
        if (cachePrefix && cacheData) {
            cacheKey = generateCacheKey(cachePrefix, cacheData);
            const cached = await getCache(cacheKey);
            if (cached) {
                console.log(`[AI-Cache] HIT: ${cacheKey}`);
                return cached;
            }
        }

        if (!process.env.GOOGLE_GENAI_API_KEY) throw new Error("GOOGLE_GENAI_API_KEY is missing.");

        const validated = await callAiWithRetry(prompt, schema);

        // 2. Save to Redis for future hits
        if (cacheKey) {
            await setCache(cacheKey, validated, 604800); // Cache for 7 days
        }

        return validated;
    } catch (error) {
        console.error(`[AI-Service-Error] ${error.message || "Unknown error"}`);
        throw error;
    }
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
5. Identify skill gaps and top skills accurately.
Identification of skill gaps and top skills accurately.
Return ONLY raw JSON in this format: 
{
  "matchScore": number,
  "technicalQuestions": [{"question": string, "intention": string, "answer": string}],
  "behavioralQuestions": [{"question": string, "intention": string, "answer": string}],
  "skillGaps": [{"skill": string, "severity": "low"|"medium"|"high"}],
  "topSkills": [string],
  "preparationPlan": [{"day": number, "focus": string, "tasks": [string]}],
  "title": string
}`

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
    // Padded links for centered look
    const linksHtml = (header.links || []).map(link => `<a href="${ensureAbsoluteUrl(link.url)}" target="_blank">${link.label}</a>`).join("&nbsp;&nbsp;&nbsp;&nbsp;");

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

    // Experience/Activities section
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
                <span class="bold right">${escape(proj.duration)} ${proj.link ? `| <a href="${ensureAbsoluteUrl(proj.link)}" target="_blank">Link</a>` : ""}</span>
            </div>
            <ul>${proj.points.map(p => `<li>${escape(p)}</li>`).join("")}</ul>
        </div>`).join("");

    const skillsHtml = (technicalSkills || []).map(s => `
        <p style="margin: 2pt 0;"><strong>${escape(s.category)}:</strong> ${escape(s.skills)}</p>
    `).join("");

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @page { size: A4; margin: 0.3in 0.4in; }
        body { 
            font-family: "Times New Roman", Times, serif; 
            font-size: 10pt; 
            line-height: 1.1; 
            color: #000; 
            margin: 0; 
            padding: 0;
        }
        .container { width: 100%; }
        header { text-align: center; margin-bottom: 4pt; }
        header h1 { font-size: 24pt; margin: 0; font-weight: normal; }
        header p { margin: 1pt 0; font-size: 9pt; }
        header .links { margin-top: 2pt; }
        header a { color: #000; text-decoration: underline; margin: 0; font-size: 9pt; }
        
        .section { margin-top: 6pt; }
        .section-title { 
            font-size: 10pt; 
            font-weight: bold; 
            text-transform: uppercase; 
            border-bottom: 1px solid #000; 
            margin: 0 0 3pt; 
            padding-bottom: 1pt; 
        }
        
        .entry { margin-bottom: 3pt; }
        .entry-header, .entry-subheader { 
            display: flex; 
            justify-content: space-between; 
            align-items: baseline; 
        }
        .bold { font-weight: bold; }
        .italic { font-style: italic; }
        .normal { font-weight: normal; }
        .right { text-align: right; }
        
        ul { margin: 1pt 0 0 14pt; padding: 0; list-style-type: disc; }
        li { margin-bottom: 0pt; text-align: justify; font-size: 9.5pt; }
        p { margin: 0; }
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
        ${section("EXPERIENCE", experienceHtml)}
        ${section("PROJECTS", projectsHtml)}
        ${section("TECHNICAL SKILLS", skillsHtml)}
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
            args: [
                "--no-sandbox", 
                "--disable-setuid-sandbox", 
                "--disable-dev-shm-usage", 
                "--single-process",
                "--disable-gpu",
                "--disable-software-rasterizer",
                "--disable-extensions",
                "--font-render-hinting=none"
            ],
            headless: "new"
        })
        /* Set a 25s timeout for the whole PDF process to prevent hanging on free tier */
        const page = await browser.newPage()
        await Promise.race([
            page.setContent(htmlContent, { waitUntil: "networkidle0" }),
            new Promise((_, reject) => setTimeout(() => reject(new Error("PDF generation timed out")), 25000))
        ]);
        return await page.pdf({ format: "A4", margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" }, printBackground: true })
    } finally {
        if (browser) {
            try {
                await browser.close()
            } catch (err) {
                console.error("[AI-Service] Failed to close browser:", err.message)
            }
        }
    }
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {
    const source = String(resume || selfDescription || "").trim()
    if (!source) throw new Error("Resume content missing.")

    const prompt = `Convert this candidate profile into a high-quality professional resume JSON. 
    Target Job: ${jobDescription || "N/A"}
    Profile: ${source}

    RULES:
    1. STRICT ONE PAGE LIMIT: The resume MUST fit on a single A4 page. Be concise. Use maximum 3 bullet points per project/experience. Keep achievements to 3-4 items max.
    2. DO NOT include a "Relevant Coursework" section. Never.
    3. Centered header, Bold capitalized sections with line below.
    4. CONTENT: Star Method points, Standard Academic order.
    5. SKILLS INJECTION: Automatically identify and ADD missing technical skills that are required for the "Target Job" but missing in "Profile", seamlessly integrating them into the Technical Skills section.
    6. Bullet points for all projects and experience. If a project has a link, fill the "link" field in the projects array.
    7. Sections must be in this EXACT order: EDUCATION, EXPERIENCE, PROJECTS, TECHNICAL SKILLS, ACHIEVEMENTS, INTERESTS.
    8. Links: METICULOUSLY identify ALL personal and professional links (LinkedIn, GitHub, Portfolio, LeetCode, Codeforces, etc.) present anywhere in the "Profile" text. Include them in the "header.links" array with appropriate labels. Ensure ALL urls are absolute (start with https://).
    9. Keep bullet points concise (max 1.5 lines each) to fit everything on one page.
    Return ONLY raw JSON matching the schema format:
    {
      "header": { "fullName": string, "email": string, "phone": string, "location": string, "links": [{"label": string, "url": string}] },
      "education": [{"institution": string, "degree": string, "duration": string, "location": string, "details": [string]}],
      "experience": [{"company": string, "role": string, "duration": string, "location": string, "points": [string]}],
      "projects": [{"title": string, "techStack": string, "duration": string, "link": string, "points": [string]}],
      "technicalSkills": [{"category": string, "skills": string}],
      "achievements": [string],
      "interests": [string]
    }`

    const data = await generateStructuredJson({ 
        prompt, 
        schema: premiumResumeSchema,
        cachePrefix: "resume-v4",
        cacheData: { resume, selfDescription, jobDescription } 
    })
    return generatePdfFromHtml(buildPremiumResumeHtml(data))
}

async function generateNoteAnswer({ domain, subdomain, question, sourceTag = "" }) {
    const prompt = `Generate an interview answer for: ${question}
Domain: ${domain}
Return ONLY raw JSON in this EXACT format:
{
  "answerText": "Detailed plain text answer with key points...",
  "answerHtml": "Same answer but professionally formatted with <strong>, <ul>, <li> tags for readability"
}`;
    return generateStructuredJson({ 
        prompt, 
        schema: noteAnswerSchema,
        cachePrefix: "note",
        cacheData: { domain, subdomain, question }
    })
}

module.exports = { generateInterviewReport, generateResumePdf, generatePdfFromHtml, generateNoteAnswer }
