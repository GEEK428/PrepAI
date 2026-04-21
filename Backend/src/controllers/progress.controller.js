const goalModel = require("../models/goal.model")
const roadmapModel = require("../models/roadmap.model")
const progressLogModel = require("../models/progressLog.model")
const notificationModel = require("../models/notification.model")
const interviewReportModel = require("../models/interviewReport.model")
const { progressProfileModel, SKILL_KEYS } = require("../models/progressProfile.model")
const { recordActivity } = require("../services/progress.service")

const DAY_ORDER = [ "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday" ]

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

function normalizeSkillLevels(input = {}) {
    const normalized = {}
    for (const skill of SKILL_KEYS) {
        const raw = Number(input?.[skill] ?? 3)
        normalized[skill] = Math.max(1, Math.min(5, Number.isFinite(raw) ? raw : 3))
    }
    return normalized
}

function normalizeDays(days = []) {
    const byDay = new Map()
    for (const day of DAY_ORDER) byDay.set(day, [])

    for (const entry of Array.isArray(days) ? days : []) {
        const day = String(entry?.day || "")
        if (!byDay.has(day)) continue
        const safeTasks = Array.isArray(entry?.tasks) ? entry.tasks : []
        const tasks = safeTasks
            .map((task) => ({
                title: String(task?.title || "").trim().slice(0, 180),
                hours: Math.max(0, Math.min(12, Number(task?.hours || 0))),
                skill: String(task?.skill || "").trim().slice(0, 80),
                completed: Boolean(task?.completed)
            }))
            .filter((task) => task.title)
            .slice(0, 20)
        byDay.set(day, tasks)
    }

    return DAY_ORDER.map((day) => ({
        day,
        tasks: byDay.get(day) || []
    }))
}

async function ensureProfile(userId) {
    let profile = await progressProfileModel.findOne({ user: userId })
    if (!profile) {
        profile = await progressProfileModel.create({
            user: userId,
            skills: normalizeSkillLevels({})
        })
    }
    return profile
}

function buildGoalProgress(goals = []) {
    return SKILL_KEYS.map((skill) => {
        const rows = goals.filter((goal) => goal.skill === skill)
        if (!rows.length) {
            return { skill, percent: 0, completed: 0, total: 0 }
        }
        const percent = Math.round(
            rows.reduce((acc, row) => acc + Math.min(100, Math.round((Number(row.currentProgress || 0) / Number(row.targetValue || 1)) * 100)), 0) / rows.length
        )
        const completed = rows.filter((row) => row.status === "completed").length
        return { skill, percent, completed, total: rows.length }
    })
}

async function saveAssessmentController(req, res) {
    const profile = await ensureProfile(req.user.id)
    const normalized = normalizeSkillLevels(req.body?.skills || {})
    profile.skills = normalized
    await profile.save()

    return res.status(200).json({
        message: "Skill assessment saved.",
        skills: normalized
    })
}

async function createGoalController(req, res) {
    const {
        skill,
        currentLevel = 1,
        targetLevel = 5,
        goalType = "questions",
        targetValue,
        dailyTarget = 1,
        durationDays = 7,
        deadline,
        currentProgress = 0
    } = req.body || {}

    const safeSkill = String(skill || "").trim().slice(0, 80)
    if (!safeSkill) {
        return res.status(400).json({ message: "Topic is required." })
    }

    if (![ "questions", "study_hours", "score_target" ].includes(goalType)) {
        return res.status(400).json({ message: "Invalid goal type." })
    }

    const safeDurationDays = Math.max(1, Number(durationDays || 1))
    const safeDailyTarget = Math.max(1, Number(dailyTarget || 1))
    const computedTargetValue = Math.max(1, Number(targetValue || (safeDailyTarget * safeDurationDays)))

    const safeDeadline = deadline ? new Date(deadline) : (() => {
        const next = new Date()
        next.setDate(next.getDate() + safeDurationDays)
        return next
    })()
    if (Number.isNaN(safeDeadline.getTime())) {
        return res.status(400).json({ message: "Invalid deadline." })
    }

    const goal = await goalModel.create({
        user: req.user.id,
        skill: safeSkill,
        currentLevel: Math.max(1, Math.min(5, Number(currentLevel || 1))),
        targetLevel: Math.max(1, Math.min(5, Number(targetLevel || 1))),
        goalType,
        targetValue: computedTargetValue,
        dailyTarget: safeDailyTarget,
        durationDays: safeDurationDays,
        startDate: new Date(),
        currentProgress: Math.max(0, Number(currentProgress || 0)),
        deadline: safeDeadline,
        status: Number(currentProgress || 0) >= computedTargetValue ? "completed" : "active",
        completedAt: Number(currentProgress || 0) >= computedTargetValue ? new Date() : null
    })

    return res.status(201).json({
        message: "Goal created.",
        goal
    })
}

async function getGoalsController(req, res) {
    const goals = await goalModel.find({ user: req.user.id }).sort({ createdAt: -1 })
    return res.status(200).json({
        message: "Goals fetched.",
        goals
    })
}

async function updateGoalController(req, res) {
    const goal = await goalModel.findOne({ _id: req.params.goalId, user: req.user.id })
    if (!goal) {
        return res.status(404).json({ message: "Goal not found." })
    }

    const patch = req.body || {}
    if (typeof patch.currentProgress !== "undefined") {
        goal.currentProgress = Math.max(0, Number(patch.currentProgress || 0))
    }
    if (typeof patch.targetValue !== "undefined") {
        goal.targetValue = Math.max(1, Number(patch.targetValue || 1))
    }
    if (typeof patch.dailyTarget !== "undefined") {
        goal.dailyTarget = Math.max(1, Number(patch.dailyTarget || 1))
    }
    if (typeof patch.durationDays !== "undefined") {
        goal.durationDays = Math.max(1, Number(patch.durationDays || 1))
    }
    if (typeof patch.targetLevel !== "undefined") {
        goal.targetLevel = Math.max(1, Math.min(5, Number(patch.targetLevel || 1)))
    }
    if (typeof patch.currentLevel !== "undefined") {
        goal.currentLevel = Math.max(1, Math.min(5, Number(patch.currentLevel || 1)))
    }
    if (typeof patch.deadline !== "undefined") {
        const safeDeadline = new Date(patch.deadline)
        if (!Number.isNaN(safeDeadline.getTime())) {
            goal.deadline = safeDeadline
        }
    }
    if (typeof patch.goalType === "string" && [ "questions", "study_hours", "score_target" ].includes(patch.goalType)) {
        goal.goalType = patch.goalType
    }

    goal.status = Number(goal.currentProgress || 0) >= Number(goal.targetValue || 1) ? "completed" : "active"
    if (goal.status === "completed" && !goal.completedAt) {
        goal.completedAt = new Date()
    }
    if (goal.status === "active") {
        goal.completedAt = null
    }
    await goal.save()

    return res.status(200).json({
        message: "Goal updated.",
        goal
    })
}

async function deleteGoalController(req, res) {
    const deleted = await goalModel.findOneAndDelete({ _id: req.params.goalId, user: req.user.id })
    if (!deleted) {
        return res.status(404).json({ message: "Goal not found." })
    }

    return res.status(200).json({ message: "Goal deleted." })
}

async function saveRoadmapController(req, res) {
    const weekStart = req.body?.weekStartDate ? startOfWeekMonday(new Date(req.body.weekStartDate)) : startOfWeekMonday(new Date())
    const days = normalizeDays(req.body?.days || [])
    const reminderTime = String(req.body?.reminderTime || "20:00").slice(0, 5)
    const reminderType = [ "in_app", "email", "both" ].includes(req.body?.reminderType) ? req.body.reminderType : "in_app"

    const roadmap = await roadmapModel.findOneAndUpdate(
        { user: req.user.id, weekStartDate: weekStart },
        {
            $set: {
                days,
                reminderTime,
                reminderType,
                lastReminderSentAt: null
            }
        },
        { new: true, upsert: true }
    )

    return res.status(200).json({
        message: "Roadmap saved.",
        roadmap
    })
}

async function updateRoadmapDayController(req, res) {
    const day = String(req.params.day || "")
    if (!DAY_ORDER.includes(day)) {
        return res.status(400).json({ message: "Invalid day." })
    }

    const weekStart = req.body?.weekStartDate ? startOfWeekMonday(new Date(req.body.weekStartDate)) : startOfWeekMonday(new Date())
    const roadmap = await roadmapModel.findOne({ user: req.user.id, weekStartDate: weekStart })
    if (!roadmap) {
        return res.status(404).json({ message: "Roadmap not found." })
    }

    const safeTasks = normalizeDays([ { day, tasks: req.body?.tasks || [] } ])[0].tasks
    roadmap.days = DAY_ORDER.map((currentDay) => {
        if (currentDay === day) {
            return { day, tasks: safeTasks }
        }
        const oldRow = roadmap.days.find((entry) => entry.day === currentDay)
        return { day: currentDay, tasks: oldRow?.tasks || [] }
    })
    await roadmap.save()

    return res.status(200).json({
        message: "Roadmap day updated.",
        roadmap
    })
}

async function updateReminderSettingsController(req, res) {
    const weekStart = req.body?.weekStartDate ? startOfWeekMonday(new Date(req.body.weekStartDate)) : startOfWeekMonday(new Date())
    const reminderTime = String(req.body?.reminderTime || "20:00").slice(0, 5)
    const reminderType = [ "in_app", "email", "both" ].includes(req.body?.reminderType) ? req.body.reminderType : "in_app"

    const roadmap = await roadmapModel.findOneAndUpdate(
        { user: req.user.id, weekStartDate: weekStart },
        {
            $set: { reminderTime, reminderType, lastReminderSentAt: null },
            $setOnInsert: { days: normalizeDays([]) }
        },
        { upsert: true, new: true }
    )

    return res.status(200).json({
        message: "Reminder settings updated.",
        roadmap
    })
}

async function createCheckinController(req, res) {
    const date = startOfDay(req.body?.date ? new Date(req.body.date) : new Date())
    const payload = {
        hoursStudied: Math.max(0, Number(req.body?.hoursStudied || 0)),
        notesCompleted: Math.max(0, Number(req.body?.notesCompleted || req.body?.goalsCompletedToday || 0)),
        mockScore: req.body?.mockScore === null || req.body?.mockScore === undefined
            ? null
            : Math.max(0, Math.min(100, Number(req.body.mockScore))),
        skillScores: req.body?.skillScores && typeof req.body.skillScores === "object" ? req.body.skillScores : {},
        completedRoadmapTasks: Math.max(0, Number(req.body?.completedRoadmapTasks || req.body?.goalsCompletedToday || 0))
    }

    const log = await progressLogModel.findOneAndUpdate(
        { user: req.user.id, date },
        { $set: payload },
        { upsert: true, new: true }
    )

    // Use shared service for streak logic
    const profile = await recordActivity(req.user.id)

    return res.status(201).json({
        message: "Check-in saved.",
        log
    })
}

async function buildStatsPayload(userId, yearInput) {
    const now = new Date()
    const weekStart = startOfWeekMonday(now)
    const selectedYear = Number.isFinite(Number(yearInput)) ? Number(yearInput) : now.getFullYear()
    
    // Safety check for profile to avoid iterations on non-iterables
    const profile = await ensureProfile(userId)
    const [ goals, roadmap ] = await Promise.all([
        goalModel.find({ user: userId }).sort({ createdAt: -1 }).lean(),
        roadmapModel.findOne({ user: userId, weekStartDate: weekStart }).lean()
    ])

    const yearStart = new Date(selectedYear, 0, 1)
    const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59, 999)

    const logs = await progressLogModel.find({
        user: userId,
        date: { $gte: yearStart, $lte: yearEnd }
    }).sort({ date: 1 }).lean()

    const goalProgress = buildGoalProgress(goals)
    const matchScoreHistory = logs
        .filter((item) => typeof item.mockScore === "number")
        .slice(-8)
        .map((item) => ({
            date: item.date,
            score: item.mockScore
        }))

    const heatmap = logs.map((item) => ({
        date: item.date,
        goalsCompleted: Math.max(0, Number(item.completedRoadmapTasks || item.notesCompleted || 0))
    }))

    const weekRows = roadmap?.days || normalizeDays([])
    const weeklyCompletedDays = weekRows.filter((row) => row.tasks.length > 0 && row.tasks.every((task) => task.completed)).length
    const weeklyTargetDays = DAY_ORDER.length

    const totalGoals = goals.length
    const completedGoals = goals.filter((goal) => goal.status === "completed").length

    const nowMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

    const currentMonthCompleted = goals.filter((goal) => goal.completedAt && new Date(goal.completedAt) >= nowMonthStart).length
    const previousMonthCompleted = goals.filter((goal) => {
        if (!goal.completedAt) return false
        const d = new Date(goal.completedAt)
        return d >= prevMonthStart && d <= prevMonthEnd
    }).length

    const completionTrendPercent = previousMonthCompleted === 0
        ? (currentMonthCompleted > 0 ? 100 : 0)
        : Math.round(((currentMonthCompleted - previousMonthCompleted) / previousMonthCompleted) * 100)

    // Ensure we return a plain object for skills
    const skills = profile.skills instanceof Map ? Object.fromEntries(profile.skills) : (profile.skills || {})

    return {
        year: selectedYear,
        skills,
        goalProgress,
        matchScoreHistory,
        heatmap,
        goalsSummary: {
            completed: completedGoals,
            total: totalGoals
        },
        completionTrendPercent,
        weeklyCompletion: {
            completedDays: weeklyCompletedDays,
            totalDays: weeklyTargetDays
        },
        streak: {
            current: profile.currentStreak || 0,
            longest: profile.longestStreak || 0
        }
    }
}

async function getStatsController(req, res) {
    try {
        const stats = await buildStatsPayload(req.user.id, req.query?.year)
        return res.status(200).json({
            message: "Progress stats fetched.",
            stats
        })
    } catch (err) {
        console.error("[Stats] Controller Error:", err.message)
        return res.status(500).json({ message: "Failed to fetch stats." })
    }
}

async function getOverviewController(req, res) {
    try {
        const weekStart = startOfWeekMonday(new Date())
        
        // Trigger activity pulse on load
        await recordActivity(req.user.id)

        const [ profile, goals, roadmap, latestReports ] = await Promise.all([
            ensureProfile(req.user.id),
            goalModel.find({ user: req.user.id }).sort({ createdAt: -1 }).lean(),
            roadmapModel.findOne({ user: req.user.id, weekStartDate: weekStart }).lean(),
            interviewReportModel.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(12).select("skillGaps").lean()
        ])
        
        const stats = await buildStatsPayload(req.user.id, req.query?.year)
        const notifications = await notificationModel.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(8).lean()

        const collectedGaps = []
        latestReports.forEach((report) => {
            ;(report?.skillGaps || []).forEach((gap) => {
                const skill = String(gap?.skill || "").trim()
                if (skill) collectedGaps.push(skill)
            })
        })
        
        if (!collectedGaps.length) {
            const skillsObj = profile.skills instanceof Map ? Object.fromEntries(profile.skills) : (profile.skills || {})
            Object.entries(skillsObj)
                .sort((a, b) => Number(a[1]) - Number(b[1]))
                .slice(0, 7)
                .forEach(([ skill ]) => collectedGaps.push(skill))
        }
        const skillGapSuggestions = [ ...new Set(collectedGaps) ].slice(0, 7)

        return res.status(200).json({
            message: "Progress overview fetched.",
            profile: {
                skills: profile.skills instanceof Map ? Object.fromEntries(profile.skills) : (profile.skills || {}),
                currentStreak: profile.currentStreak || 0,
                longestStreak: profile.longestStreak || 0
            },
            goals,
            roadmap: roadmap || {
                weekStartDate: weekStart,
                days: normalizeDays([]),
                reminderTime: "20:00",
                reminderType: "in_app"
            },
            skillGapSuggestions,
            notifications,
            stats
        })
    } catch (err) {
        console.error("[Overview] Controller Error:", err.message)
        return res.status(500).json({ message: "Failed to fetch progress overview." })
    }
}

async function getNotificationsController(req, res) {
    const notifications = await notificationModel.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(30).lean()
    const unreadCount = notifications.filter((item) => !item.readAt).length

    return res.status(200).json({
        message: "Notifications fetched.",
        notifications,
        unreadCount
    })
}

async function markNotificationReadController(req, res) {
    const { notificationId } = req.params
    const updated = await notificationModel.findOneAndUpdate(
        { _id: notificationId, user: req.user.id },
        { $set: { readAt: new Date() } },
        { new: true }
    )

    if (!updated) {
        return res.status(404).json({ message: "Notification not found." })
    }

    return res.status(200).json({
        message: "Notification marked as read.",
        notification: updated
    })
}

async function markAllNotificationsReadController(req, res) {
    await notificationModel.updateMany(
        { user: req.user.id, readAt: null },
        { $set: { readAt: new Date() } }
    )
    return res.status(200).json({
        message: "All notifications marked as read."
    })
}

module.exports = {
    saveAssessmentController,
    createGoalController,
    getGoalsController,
    updateGoalController,
    deleteGoalController,
    saveRoadmapController,
    updateRoadmapDayController,
    updateReminderSettingsController,
    createCheckinController,
    getStatsController,
    getOverviewController,
    getNotificationsController,
    markNotificationReadController,
    markAllNotificationsReadController
}
