import { GoogleGenAI } from "@google/genai"
import crypto from "crypto"
import { zodToJsonSchema } from "zod-to-json-schema"
import { interviewReportSchema, premiumResumeSchema, noteAnswerSchema } from "../models/ai.schemas"

const ensureAbsoluteUrl = (url = "") => {
    const s = url.trim();
    if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("mailto:") || s.startsWith("tel:")) {
        return s;
    }
    return `https://${s}`;
};
let puppeteerLib = null;

const RESUME_AI_MODEL = "gemini-2.0-flash-exp"; 

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
    if (typeof response.text === "string") return response.text
    if (typeof response.text === "function") return response.text()
    
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
        const fenced = text.match(/```(?:\w+)?\s*([\s\S]*?)\s*```/i)
        if (fenced?.[1]) return JSON.parse(fenced[1].trim())
        throw new Error("AI returned malformed JSON: " + text.slice(0, 100));
    }
}

const FALLBACK_MODEL = "gemini-1.5-pro";
const SECONDARY_FALLBACK = "gemini-1.5-flash";
const MAX_RETRIES = 5;

async function callAiWithRetry(prompt, schema) {
    const ai = getAi();
    const models = [RESUME_AI_MODEL, FALLBACK_MODEL, SECONDARY_FALLBACK];
    let lastError = null;

    for (const model of models) {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                console.log(`[AI-Service] Trying ${model} (attempt ${attempt}/${MAX_RETRIES})...`);
                
                // Extra high patience for next-gen models (60s timeout)
                const response = await Promise.race([
                    ai.models.generateContent({
                        model,
                        contents: [{ role: "user", parts: [{ text: prompt }] }],
                        generationConfig: {
                            responseMimeType: "application/json",
                            responseSchema: zodToJsonSchema(schema),
                        }
                    }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error(`AI Request timed out after 60s on ${model}`)), 60000))
                ]);

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
                const isRetryable = msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("overloaded") || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("timeout");
                console.warn(`[AI-Service] ${model} attempt ${attempt} failed: ${msg.slice(0, 120)}`);
                
                if (!isRetryable) break; 
                if (attempt < MAX_RETRIES) {
                    const delay = attempt * 3000; // Even more patient: 3s, 6s, 9s...
                    console.log(`[AI-Service] Waiting ${delay}ms before retry...`);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }
        console.log(`[AI-Service] All attempts exhausted for ${model}, trying next model...`);
    }

    console.error("[AI-Service-Error]", JSON.stringify(lastError));
    throw lastError;
}

async function generateStructuredJson({ prompt, schema, cachePrefix = "ai", cacheData = {} }) {
    const { getCache, setCache } = require("../utils/redis")
    const cacheKey = generateCacheKey(cachePrefix, cacheData)
    
    const cached = await getCache(cacheKey)
    if (cached) {
        console.log(`[AI-Service] Cache hit: ${cacheKey}`)
        return cached
    }

    const result = await callAiWithRetry(prompt, schema)
    await setCache(cacheKey, result, 86400) 
    return result
}

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {
    const prompt = `You are a world-class Technical Interviewer. Analyze this candidate for the role: ${jobDescription || "Not Specified"}.
Resume/Profile: ${resume || selfDescription || "N/A"}

Requirements:
1. Calculate a realistic matchScore (0-100).
2. Generate EXACTLY 4 technical questions tailored to the role.
3. Generate EXACTLY 4 behavioral questions.
4. Provide a PROPER 7-day preparation plan.
5. Identify skill gaps and top skills accurately.
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

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @page { size: A4; margin: 0.3in 0.4in; }
        body { font-family: "Times New Roman", Times, serif; font-size: 10pt; line-height: 1.1; color: #000; margin: 0; padding: 0; }
        .container { width: 100%; }
        header { text-align: center; margin-bottom: 4pt; }
        header h1 { font-size: 24pt; margin: 0; font-weight: normal; }
        header p { margin: 1pt 0; }
        header a { color: #000; text-decoration: none; border-bottom: 0.5pt solid #000; }
        .section { margin-top: 8pt; }
        .section-title { font-size: 11pt; border-bottom: 0.8pt solid #000; margin-bottom: 3pt; padding-bottom: 1pt; font-weight: bold; text-transform: uppercase; }
        .entry { margin-bottom: 6pt; }
        .entry-header { display: flex; justify-content: space-between; font-weight: bold; }
        .entry-subheader { display: flex; justify-content: space-between; font-style: italic; }
        .bold { font-weight: bold; }
        .italic { font-style: italic; }
        .right { text-align: right; min-width: 1.5in; }
        .normal { font-weight: normal; }
        ul { margin: 2pt 0 0 15pt; padding: 0; }
        li { margin-bottom: 1.5pt; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>${escape(header.fullName)}</h1>
            <p>${escape(header.location)} | ${escape(header.phone)} | ${escape(header.email)}</p>
            <p>${linksHtml}</p>
        </header>
        ${section("Education", educationHtml)}
        ${section("Experience", experienceHtml)}
        ${section("Projects", projectsHtml)}
        ${section("Technical Skills", skillsHtml)}
        ${achievements?.length ? section("Achievements", `<ul>${achievements.map(a => `<li>${escape(a)}</li>`).join("")}</ul>`) : ""}
        ${interests?.length ? section("Interests", `<p>${interests.map(i => escape(i)).join(", ")}</p>`) : ""}
    </div>
</body>
</html>`;
}

let _browserInstance = null;
let _browserLock = false;
let _activePages = 0;
const MAX_PAGES = 2;

async function getBrowser() {
    if (_browserInstance && _browserInstance.connected) return _browserInstance;
    
    if (_browserLock) {
        while (_browserLock) await new Promise(r => setTimeout(r, 100));
        return getBrowser();
    }

    _browserLock = true;
    try {
        if (!puppeteerLib) {
            puppeteerLib = require("puppeteer");
        }
        
        console.log("[Puppeteer] Launching singleton browser instance...");
        _browserInstance = await puppeteerLib.launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process'
            ],
            timeout: 30000
        });
        
        _browserInstance.on("disconnected", () => {
            console.log("[Puppeteer] Browser disconnected. Clearing instance.");
            _browserInstance = null;
        });

        return _browserInstance;
    } catch (err) {
        console.error("[Puppeteer] Launch Error:", err.message);
        throw err;
    } finally {
        _browserLock = false;
    }
}

async function generatePdfFromHtml(htmlContent) {
    const startWait = Date.now();
    while (_activePages >= MAX_PAGES) {
        if (Date.now() - startWait > 20000) {
            console.error("[Puppeteer] Concurrency timeout.");
            throw new Error("Server is busy. Please try again soon.");
        }
        await new Promise(r => setTimeout(r, 500));
    }
    
    _activePages++;
    let browser = null;
    let page = null;
    try {
        browser = await getBrowser();
        page = await Promise.race([
            browser.newPage(),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Page creation timeout")), 15000))
        ]);

        await Promise.race([
            page.setContent(htmlContent, { waitUntil: "networkidle0" }),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Content load timeout")), 25000))
        ]);
        
        return await page.pdf({ 
            format: "A4", 
            margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" }, 
            printBackground: true 
        });
    } catch (err) {
        console.error("[Puppeteer] PDF Error:", err.message);
        if (err.message.includes("timeout") || err.message.includes("Protocol error")) {
            _browserInstance = null; 
        }
        throw err;
    } finally {
        _activePages--; 
        if (page) {
            try { await page.close(); } catch (e) {}
        }
    }
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {
    const source = String(resume || selfDescription || "").trim()
    if (!source) throw new Error("Resume content missing.")

    const prompt = `Convert this candidate profile into a high-quality professional resume JSON. 
    Target Job: ${jobDescription || "N/A"}
    Profile: ${source}
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

async function generateNoteAnswer({ domain, subdomain, question }) {
    const prompt = `Generate an interview answer for: ${question}
Domain: ${domain}
Return ONLY raw JSON:
{
  "answerText": string,
  "answerHtml": string
}`;
    return generateStructuredJson({ 
        prompt, 
        schema: noteAnswerSchema,
        cachePrefix: "note",
        cacheData: { domain, subdomain, question }
    })
}

module.exports = { generateInterviewReport, generateResumePdf, generatePdfFromHtml, generateNoteAnswer }
