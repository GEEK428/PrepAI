const nodemailer = require("nodemailer");
const { Resend } = require("resend");
const roadmapModel = require("../models/roadmap.model")
const userModel = require("../models/user.model")
const notificationModel = require("../models/notification.model")
const goalModel = require("../models/goal.model")

function startOfDay(dateValue = new Date()) {
    const d = new Date(dateValue)
    d.setHours(0, 0, 0, 0)
    return d
}

function startOfWeekMonday(dateValue = new Date()) {
    const d = startOfDay(dateValue)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    return d
}

function isSameDay(a, b) {
    if (!a || !b) return false
    return startOfDay(a).getTime() === startOfDay(b).getTime()
}

function hhmmToMinutes(value = "00:00") {
    const [ hhRaw, mmRaw ] = String(value || "00:00").split(":")
    const hh = Math.max(0, Math.min(23, Number(hhRaw || 0)))
    const mm = Math.max(0, Math.min(59, Number(mmRaw || 0)))
    return (hh * 60) + mm
}

function shouldTriggerNow(reminderTime, now) {
    const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    const ist = new Date(istString)
    const nowMinutes = (ist.getHours() * 60) + ist.getMinutes()
    return nowMinutes >= hhmmToMinutes(reminderTime)
}

async function sendEmailSafe({ to, subject, text, html }) {
    const { RESEND_API_KEY, RESEND_FROM_EMAIL } = process.env;
    if (!RESEND_API_KEY) {
        console.log(`[ReminderEmail:Preview] ${to} | ${subject} | ${text}`);
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
        console.log(`[ReminderEmail:Failed] ${e.message}`);
    }
}

async function createInAppNotification({ userId, type, title, message, meta = {} }) {
    await notificationModel.create({
        user: userId,
        type,
        title,
        message,
        meta
    })
}

async function processRoadmapReminder(roadmap, now) {
    const user = await userModel.findById(roadmap.user).select("email username")
    if (!user) return

    if (isSameDay(roadmap.lastReminderSentAt, now)) {
        return
    }

    const today = startOfDay(now)
    const activeGoals = await goalModel.find({
        user: user._id,
        status: "active"
    }).sort({ deadline: 1 })

    const ongoingGoals = activeGoals.filter((goal) => new Date(goal.deadline) >= today)
    const overdueGoals = activeGoals.filter((goal) => new Date(goal.deadline) < today)

    if (!ongoingGoals.length && !overdueGoals.length) {
        roadmap.lastReminderSentAt = now
        await roadmap.save()
        return
    }

    if (ongoingGoals.length) {
        const nearest = ongoingGoals[0]
        const deadlineDay = startOfDay(nearest.deadline)
        const daysLeft = Math.max(0, Math.round((deadlineDay - today) / (1000 * 60 * 60 * 24)))
        const title = `Complete your ${nearest.skill} goal (${nearest.currentProgress}/${nearest.targetValue})`
        const message = `${daysLeft} day(s) left.`

        if ([ "in_app", "both" ].includes(roadmap.reminderType)) {
            await createInAppNotification({
                userId: user._id,
                type: "reminder",
                title,
                message,
                meta: { goalId: String(nearest._id), skill: nearest.skill, deadline: nearest.deadline }
            })
        }

        if ([ "email", "both" ].includes(roadmap.reminderType)) {
            await sendEmailSafe({
                to: user.email,
                subject: "IntelliPrep Daily Reminder",
                text: `Hi ${user.username || "there"},\n\nPlease continue your goal: ${nearest.skill}.\nProgress: ${nearest.currentProgress}/${nearest.targetValue}\nDays left: ${daysLeft}\n\nKeep going.`,
                html: `
                    <p>Hi ${user.username || "there"},</p>
                    <p>Please continue your goal: <strong>${nearest.skill}</strong>.</p>
                    <p>Progress: ${nearest.currentProgress}/${nearest.targetValue}<br/>Days left: ${daysLeft}</p>
                    <p>Keep going.</p>
                `
            })
        }
    }

    if (overdueGoals.length) {
        const overdue = overdueGoals[0]
        const title = `Complete your ${overdue.skill} goal (${overdue.currentProgress}/${overdue.targetValue})`
        const message = "Deadline missed."

        if ([ "in_app", "both" ].includes(roadmap.reminderType)) {
            await createInAppNotification({
                userId: user._id,
                type: "catch_up",
                title,
                message,
                meta: { goalId: String(overdue._id), deadline: overdue.deadline }
            })
        }

        if ([ "email", "both" ].includes(roadmap.reminderType)) {
            const bullets = overdueGoals
                .map((goal) => `- ${goal.skill} (${goal.currentProgress}/${goal.targetValue}) · deadline: ${new Date(goal.deadline).toLocaleDateString()}`)
                .join("\n")
            const htmlBullets = overdueGoals
                .map((goal) => `<li>${goal.skill} (${goal.currentProgress}/${goal.targetValue}) - deadline: ${new Date(goal.deadline).toLocaleDateString()}</li>`)
                .join("")

            await sendEmailSafe({
                to: user.email,
                subject: "IntelliPrep Deadline Missed Alert",
                text: `Hi ${user.username || "there"},\n\nWe have noticed that you have not completed these tasks:\n${bullets}\n\nPlease complete them at the earliest.`,
                html: `
                    <p>Hi ${user.username || "there"},</p>
                    <p>We have noticed that you have not completed these tasks:</p>
                    <ul>${htmlBullets}</ul>
                    <p>Please complete them at the earliest.</p>
                `
            })
        }
    }

    roadmap.lastReminderSentAt = now
    await roadmap.save()
}

function startReminderScheduler() {
    setInterval(async () => {
        try {
            const now = new Date()
            const todayStart = startOfDay(now)
            const roadmaps = await roadmapModel.find({
                $or: [
                    { lastReminderSentAt: null },
                    { lastReminderSentAt: { $lt: todayStart } }
                ]
            }).limit(1000)

            for (const roadmap of roadmaps) {
                if (!shouldTriggerNow(roadmap.reminderTime, now)) {
                    continue
                }
                await processRoadmapReminder(roadmap, now)
            }
        } catch (error) {
            console.log("Reminder scheduler error:", error?.message || error)
        }
    }, 60 * 1000)
}

module.exports = { startReminderScheduler }
