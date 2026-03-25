const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
const { zodToJsonSchema } = require("zod-to-json-schema")
const puppeteer = require("puppeteer")

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
})


const interviewReportSchema = z.object({
    matchScore: z.number().describe("A score between 0 and 100 indicating how well the candidate's profile matches the job describe"),
    technicalQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Technical questions that can be asked in the interview along with their intention and how to answer them"),
    behavioralQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Behavioral questions that can be asked in the interview along with their intention and how to answer them"),
    skillGaps: z.array(z.object({
        skill: z.string().describe("The skill which the candidate is lacking"),
        severity: z.enum([ "low", "medium", "high" ]).describe("The severity of this skill gap, i.e. how important is this skill for the job and how much it can impact the candidate's chances")
    })).describe("List of skill gaps in the candidate's profile along with their severity"),
    topSkills: z.array(z.string()).describe("Top 3-6 skills where candidate profile strongly matches the job description"),
    preparationPlan: z.array(z.object({
        day: z.number().describe("The day number in the preparation plan, starting from 1"),
        focus: z.string().describe("The main focus of this day in the preparation plan, e.g. data structures, system design, mock interviews etc."),
        tasks: z.array(z.string()).describe("List of tasks to be done on this day to follow the preparation plan, e.g. read a specific book or article, solve a set of problems, watch a video etc.")
    })).describe("A day-wise preparation plan for the candidate to follow in order to prepare for the interview effectively"),
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

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(interviewReportSchema),
        }
    })

    return JSON.parse(response.text)


}



async function generatePdfFromHtml(htmlContent) {
    const browser = await puppeteer.launch({
        executablePath: process.env.NODE_ENV === "production" ? "/usr/bin/chromium" : undefined,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--single-process"],
        headless: "new"
    })
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" })

    const pdfBuffer = await page.pdf({
        format: "A4", margin: {
            top: "20mm",
            bottom: "20mm",
            left: "15mm",
            right: "15mm"
        }
    })

    await browser.close()

    return pdfBuffer
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {

    const resumePdfSchema = z.object({
        html: z.string().describe("The HTML content of the resume which can be converted to PDF using any library like puppeteer")
    })

    const prompt = `Generate a professional single-page resume using only the information provided below.

Candidate Data:
- Resume Text: ${resume}
- Self Description: ${selfDescription}
- Target Job Description: ${jobDescription}

Hard Rules:
1) Output MUST fit within exactly one A4 page when converted to PDF. Keep formatting incredibly tight and concise.
2) Do NOT invent or hallucinate any detail. Use only facts from Resume Text and Self Description.
3) Keep the writing brief, quantified, and impact-focused.
4) If a section has no reliable information, omit or keep it extremely short rather than fabricating.
5) Use clean vertical tight spacing, proper hierarchical headings, and minimal bullet points.
6) For Personal Details, explicitly extract and print the candidate's Name at the very top as a huge header, followed immediately below by a tight horizontal row containing their LinkedIn, LeetCode, GitHub links, Email, Phone Number, and any other contact details found.

Strict adherence to section order (and ONLY this order):
1. Personal Details (Name exactly at top, then LinkedIn/LeetCode/Github/contact right below)
2. Education
3. Skills
4. Projects
5. Experience
6. Achievements

Output format:
- Return strictly JSON with one field: "html"
- "html" must be complete resume HTML suitable for PDF generation.
- The HTML MUST include inline CSS styles with incredibly clean, ultra-compact minimal styling (e.g. margin/padding: 0) to guarantee it stays strictly on one page mostly.
`

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(resumePdfSchema),
        }
    })


    const jsonContent = JSON.parse(response.text)

    const pdfBuffer = await generatePdfFromHtml(jsonContent.html)

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

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(noteAnswerSchema)
        }
    })

    return JSON.parse(response.text)
}

module.exports = { generateInterviewReport, generateResumePdf, generatePdfFromHtml, generateNoteAnswer }
