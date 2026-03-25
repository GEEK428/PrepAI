const fs = require('fs');
const authPath = 'Backend/src/controllers/auth.controller.js';
let authSrc = fs.readFileSync(authPath, 'utf8');

// 1. Add Resend import
if (!authSrc.includes('require("resend")')) {
    authSrc = authSrc.replace('const nodemailer = require("nodemailer")', 'const nodemailer = require("nodemailer");\nconst { Resend } = require("resend");');
}

// 2. Rewrite forgot password
authSrc = authSrc.replace(/async function sendForgotPasswordEmail\(\{ email, resetUrl \}\) \{[\s\S]*?throw new Error\("Email service is temporarily unavailable\. Please try again later\."\)\r?\n    \}\r?\n\}/,
`async function sendForgotPasswordEmail({ email, resetUrl }) {
    const { RESEND_API_KEY, RESEND_FROM_EMAIL } = process.env;
    if (!RESEND_API_KEY) {
        console.log(\`[ForgotPassword] Resend not configured. Reset URL for \${email}: \${resetUrl}\`);
        return;
    }
    try {
        const resend = new Resend(RESEND_API_KEY);
        const { error } = await resend.emails.send({
            from: RESEND_FROM_EMAIL || 'onboarding@resend.dev',
            to: email,
            subject: "Reset your IntelliPrep password",
            html: \`
                <div style="font-family: Arial, sans-serif; color: #111;">
                    <h2>Reset your IntelliPrep password</h2>
                    <p>We received a request to reset your password.</p>
                    <p>
                        <a href="\${resetUrl}" target="_blank" rel="noopener noreferrer">Reset Password</a>
                    </p>
                    <p>This link expires in 15 minutes.</p>
                    <p>If you did not request this, you can ignore this email.</p>
                </div>
            \`
        });
        if (error) throw new Error(error.message);
    } catch (e) {
        console.log(\`[ForgotPassword] Failed to send: \${e.message}\`);
        throw new Error("Email service is temporarily unavailable. Please try again later.");
    }
}`);

// 3. Rewrite verification
authSrc = authSrc.replace(/async function sendVerificationEmail\(\{ email, verifyUrl \}\) \{[\s\S]*?throw new Error\("Email service is temporarily unavailable\. Please try again later\."\)\r?\n    \}\r?\n\}/,
`async function sendVerificationEmail({ email, verifyUrl }) {
    const { RESEND_API_KEY, RESEND_FROM_EMAIL } = process.env;
    if (!RESEND_API_KEY) {
        console.log(\`[VerifyEmail] Resend not configured. Verify URL for \${email}: \${verifyUrl}\`);
        return;
    }
    try {
        const resend = new Resend(RESEND_API_KEY);
        const { error } = await resend.emails.send({
            from: RESEND_FROM_EMAIL || 'onboarding@resend.dev',
            to: email,
            subject: "Verify your IntelliPrep account",
            html: \`
                <div style="font-family: Arial, sans-serif; color: #111;">
                    <h2>Welcome to IntelliPrep!</h2>
                    <p>Please verify your email address to complete your registration.</p>
                    <p>
                        <a href="\${verifyUrl}" target="_blank" rel="noopener noreferrer"
                           style="display:inline-block;padding:10px 24px;background:#569bcd;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;"
                        >Verify Email</a>
                    </p>
                    <p>This link expires in 24 hours.</p>
                    <p>If you did not create an account, you can ignore this email.</p>
                </div>
            \`
        });
        if (error) throw new Error(error.message);
    } catch (e) {
        console.log(\`[VerifyEmail] Failed to send: \${e.message}\`);
        throw new Error("Email service is temporarily unavailable. Please try again later.");
    }
}`);
fs.writeFileSync(authPath, authSrc);

const remPath = 'Backend/src/services/reminder.scheduler.js';
let remSrc = fs.readFileSync(remPath, 'utf8');

if (!remSrc.includes('require("resend")')) {
    remSrc = remSrc.replace('const nodemailer = require("nodemailer")', 'const nodemailer = require("nodemailer");\nconst { Resend } = require("resend");');
}

remSrc = remSrc.replace(/async function sendEmailSafe\(\{ to, subject, text, html \}\) \{[\s\S]*?console\.log\(`\[ReminderEmail:Failed\] \$\{e\.message\}`\)\r?\n    \}\r?\n\}/,
`async function sendEmailSafe({ to, subject, text, html }) {
    const { RESEND_API_KEY, RESEND_FROM_EMAIL } = process.env;
    if (!RESEND_API_KEY) {
        console.log(\`[ReminderEmail:Preview] \${to} | \${subject} | \${text}\`);
        return;
    }
    try {
        const resend = new Resend(RESEND_API_KEY);
        const { error } = await resend.emails.send({
            from: RESEND_FROM_EMAIL || 'onboarding@resend.dev',
            to,
            subject,
            html
        });
        if (error) throw new Error(error.message);
    } catch (e) {
        console.log(\`[ReminderEmail:Failed] \${e.message}\`);
    }
}`);
fs.writeFileSync(remPath, remSrc);
console.log("Resend integrated!");
