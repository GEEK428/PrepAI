const fs = require('fs');

// Fix ai.service.js
let aiContent = fs.readFileSync('Backend/src/services/ai.service.js', 'utf8');
aiContent = aiContent.replace(
    /async function generatePdfFromHtml\(htmlContent\) \{[\s\S]*?return pdfBuffer\r?\n\}/,
`async function generatePdfFromHtml(htmlContent) {
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
            format: "A4", margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" }
        });
        return pdfBuffer;
    } finally {
        if (browser) await browser.close();
    }
}`);
fs.writeFileSync('Backend/src/services/ai.service.js', aiContent);


// Fix reminder.scheduler.js
let remContent = fs.readFileSync('Backend/src/services/reminder.scheduler.js', 'utf8');
remContent = remContent.replace(
    /await transporter\.sendMail\(\{[\s\S]*?from: SMTP_FROM \|\| SMTP_USER,[\s\S]*?to,[\s\S]*?subject,[\s\S]*?text,[\s\S]*?html\r?\n    \}\)/,
`try {
        await transporter.sendMail({
            from: SMTP_FROM || SMTP_USER,
            to,
            subject,
            text,
            html
        });
    } catch (error) {
        console.error("Failed to send email:", error.message);
    }`
);

remContent = remContent.replace(
    /const daysLeft = Math\.max\(0, Math\.ceil\(\(new Date\(nearest\.deadline\) - today\) \/ \(1000 \* 60 \* 60 \* 24\)\)\)/,
    `const deadlineDay = startOfDay(nearest.deadline);\n        const daysLeft = Math.max(0, Math.round((deadlineDay - today) / (1000 * 60 * 60 * 24)));`
);

fs.writeFileSync('Backend/src/services/reminder.scheduler.js', remContent);
console.log("Done");
