import React, { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router"
import "../style/home.scss"
import "../style/progress-tracker.scss"
import {
    createGoal,
    getProgressOverview,
    saveReminders,
    updateGoal
} from "../services/progress.api"
import Sidebar from "../components/Sidebar"
import NotificationBell from "../components/NotificationBell"
import Loader from "../../../components/Loader"

function formatDateKey(dateValue) {
    const d = new Date(dateValue)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
}

function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate()
}

const ProgressTracker = () => {
    const navigate = useNavigate()

    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const [message, setMessage] = useState("")

    const currentYear = new Date().getFullYear()
    const [selectedYear, setSelectedYear] = useState(currentYear)

    const [skillGapSuggestions, setSkillGapSuggestions] = useState([])
    const [goals, setGoals] = useState([])
    const [goalForm, setGoalForm] = useState({ topic: "", durationDays: 7, targetPerDay: 3 })
    const [reminderTime, setReminderTime] = useState("20:00")
    const [reminderType, setReminderType] = useState("both")
    const [stats, setStats] = useState({ goalsSummary: { completed: 0, total: 0 }, completionTrendPercent: 0, heatmap: [], streak: { current: 0, longest: 0 } })

    const [showAllGoals, setShowAllGoals] = useState(false)
    const [showAllCompletedTopics, setShowAllCompletedTopics] = useState(false)
    const [draggedIndex, setDraggedIndex] = useState(null)
    const [tick, setTick] = useState(Date.now())
    const heatmapScrollRef = useRef(null)
    const [heatmapSliderMax, setHeatmapSliderMax] = useState(0)
    const [heatmapSliderValue, setHeatmapSliderValue] = useState(0)



    const loadOverview = async (year = selectedYear) => {
        setLoading(true)
        setError("")
        try {
            const response = await getProgressOverview(year)
            setGoals(response?.goals || [])
            setSkillGapSuggestions((response?.skillGapSuggestions || []).slice(0, 7))
            setReminderTime(response?.roadmap?.reminderTime || "20:00")
            setReminderType(response?.roadmap?.reminderType || "both")

            if (response?.stats) setStats(response.stats)
        } catch (err) {
            setError(err?.response?.data?.message || "Unable to load progress tracker.")
        } finally {
            setLoading(false)
        }
    }



    useEffect(() => {
        document.title = "Track Your Progress | IntelliPrep"
        loadOverview(currentYear)
    }, [])

    useEffect(() => {
        loadOverview(selectedYear)
    }, [ selectedYear ])

    useEffect(() => {
        const timer = setInterval(() => setTick(Date.now()), 15000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        const syncSliderBounds = () => {
            const el = heatmapScrollRef.current
            if (!el) return
            const max = Math.max(0, el.scrollWidth - el.clientWidth)
            setHeatmapSliderMax(max)
            setHeatmapSliderValue(Math.min(el.scrollLeft, max))
        }

        syncSliderBounds()
        window.addEventListener("resize", syncSliderBounds)
        return () => window.removeEventListener("resize", syncSliderBounds)
    }, [ selectedYear, goals ])





    const visibleGoalTasks = useMemo(() => {
        const now = Date.now()
        return goals
            .filter((goal) => {
                if (goal.status !== "completed") return true
                const completedAt = goal.completedAt ? new Date(goal.completedAt).getTime() : now
                return now - completedAt <= 60 * 1000
            })
            .sort((a, b) => {
                if (a.status === b.status) return new Date(a.deadline) - new Date(b.deadline)
                return a.status === "active" ? -1 : 1
            })
    }, [ goals, tick ])
    const previewGoalTasks = useMemo(() => visibleGoalTasks.slice(0, 3), [ visibleGoalTasks ])

    const completedGoals = useMemo(() => {
        return goals
            .filter((goal) => {
                const total = Math.max(1, Number(goal.targetValue || 1))
                const current = Number(goal.currentProgress || 0)
                return goal.status === "completed" || current >= total
            })
            .map((goal) => ({
                ...goal,
                completedAt: goal.completedAt || goal.updatedAt || goal.createdAt || new Date().toISOString()
            }))
            .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
    }, [ goals ])

    const previewCompletedGoals = useMemo(() => completedGoals.slice(0, 3), [ completedGoals ])

    const heatmapByDate = useMemo(() => {
        const map = new Map()
        completedGoals.forEach((goal) => {
            const key = formatDateKey(goal.completedAt)
            map.set(key, Number(map.get(key) || 0) + 1)
        })
        return map
    }, [ completedGoals ])

    const yearHeatmap = useMemo(() => {
        const months = Array.from({ length: 12 }).map((_, monthIndex) => {
            const monthStart = new Date(selectedYear, monthIndex, 1)
            const firstDayOffset = monthStart.getDay() // Sunday-first English calendar layout
            const totalDays = daysInMonth(selectedYear, monthIndex)
            const days = Array.from({ length: totalDays }).map((__, dayIdx) => {
                const date = new Date(selectedYear, monthIndex, dayIdx + 1)
                const key = formatDateKey(date)
                return {
                    key,
                    date,
                    value: Number(heatmapByDate.get(key) || 0)
                }
            })
            return {
                monthIndex,
                monthLabel: monthStart.toLocaleString("en-US", { month: "short" }),
                fullMonthLabel: monthStart.toLocaleString("en-US", { month: "long" }),
                firstDayOffset,
                totalDays,
                days
            }
        })

        const totalSubmissions = months.reduce(
            (acc, month) => acc + month.days.reduce((mAcc, day) => mAcc + day.value, 0),
            0
        )
        const totalActiveDays = months.reduce(
            (acc, month) => acc + month.days.filter((day) => day.value > 0).length,
            0
        )

        return { months, totalSubmissions, totalActiveDays }
    }, [ selectedYear, heatmapByDate ])

    const addGoalHandler = async () => {
        const topic = String(goalForm.topic || "").trim()
        if (!topic) {
            setError("Topic is required.")
            return
        }

        setSaving(true)
        setError("")
        setMessage("")

        try {
            const durationDays = Math.max(1, Number(goalForm.durationDays || 1))
            const dailyTarget = Math.max(1, Number(goalForm.targetPerDay || 1))
            const deadline = new Date()
            deadline.setDate(deadline.getDate() + durationDays)

            await createGoal({
                skill: topic,
                durationDays,
                dailyTarget,
                targetValue: durationDays * dailyTarget,
                deadline,
                goalType: "questions"
            })

            setGoalForm({ topic: "", durationDays: 7, targetPerDay: 3 })
            setMessage("Goal added.")
            await loadOverview(selectedYear)
        } catch (err) {
            setError(err?.response?.data?.message || "Unable to add goal.")
        } finally {
            setSaving(false)
        }
    }

    const saveReminderHandler = async () => {
        setSaving(true)
        setError("")
        setMessage("")
        try {
            await saveReminders({ reminderTime, reminderType })
            setMessage("Reminder settings saved.")
            await loadOverview(selectedYear)
        } catch (err) {
            setError(err?.response?.data?.message || "Unable to save reminders.")
        } finally {
            setSaving(false)
        }
    }

    const trendPercent = useMemo(() => {
        const now = new Date()
        now.setHours(0, 0, 0, 0)

        const sumRange = (fromOffset, toOffset) => {
            let sum = 0
            for (let i = fromOffset; i <= toOffset; i++) {
                const d = new Date(now)
                d.setDate(now.getDate() + i)
                sum += Number(heatmapByDate.get(formatDateKey(d)) || 0)
            }
            return sum
        }

        const currentWeek = sumRange(-6, 0)
        const previousWeek = sumRange(-13, -7)

        if (previousWeek === 0) return currentWeek > 0 ? 100 : 0
        return Math.round(((currentWeek - previousWeek) / previousWeek) * 100)
    }, [ heatmapByDate ])
    const trendClass = trendPercent >= 0 ? "up" : "down"

    const availableYears = useMemo(() => {
        const years = []
        for (let y = currentYear; y >= currentYear - 6; y--) years.push(y)
        return years
    }, [ currentYear ])

    return (
        <main className="dashboard-page">
            <Sidebar />

            <section className="dashboard-main progress-main">
                <header className="dashboard-header progress-head sleek" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <p className="dashboard-kicker">Analytics Dashboard</p>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.8rem', color: '#9fd0f4' }}>monitoring</span>
                            Track Your Progress
                        </h1>
                    </div>
                    <NotificationBell />
                </header>

                <section className="progress-grid compact-2">
                    <article className="progress-card playcard glass">
                        <h3>Suggested Skill Gaps</h3>
                        <div className="chip-flow">
                            {skillGapSuggestions.map((item, idx) => (
                                <span key={`${item}-${idx}`}>{item}</span>
                            ))}
                            {!skillGapSuggestions.length && <span>No gaps available yet</span>}
                        </div>
                    </article>

                    <article className="progress-card glass">
                        <h3>Set Your Goals</h3>
                        <div className="goal-form minimal">
                            <label>Topic
                                <input value={goalForm.topic} onChange={(e) => setGoalForm((prev) => ({ ...prev, topic: e.target.value }))} placeholder="Example: System Design" />
                            </label>
                            <label>Number of days
                                <input type="number" min="1" value={goalForm.durationDays} onChange={(e) => setGoalForm((prev) => ({ ...prev, durationDays: e.target.value }))} />
                            </label>
                            <label>Target questions per day
                                <input type="number" min="1" value={goalForm.targetPerDay} onChange={(e) => setGoalForm((prev) => ({ ...prev, targetPerDay: e.target.value }))} />
                            </label>
                            <button type="button" className="generate-btn compact" onClick={addGoalHandler} disabled={saving}>Add Goal</button>
                        </div>
                    </article>
                </section>

                <section className="progress-card glass">
                    <h3>Track Your Progress</h3>
                    <div className="task-history">
                        {!previewGoalTasks.length && <p className="notes-meta">No ongoing tasks.</p>}
                        {previewGoalTasks.map((goal, index) => {
                            const total = Math.max(1, Number(goal.targetValue || 1))
                            const current = Number(goal.currentProgress || 0)
                            const percent = Math.min(100, Math.round((current / total) * 100))
                            const marker = goal.status === "completed" ? "completed" : "ongoing"

                            return (
                                <article
                                    key={goal._id}
                                    className={`task-item ${marker}`}
                                    draggable
                                    onDragStart={() => setDraggedIndex(index)}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={() => {
                                        if (draggedIndex === null || draggedIndex === index) {
                                            setDraggedIndex(null)
                                            return
                                        }
                                        setGoals((prev) => {
                                            const draft = [ ...prev ]
                                            const moved = draft[draggedIndex]
                                            draft.splice(draggedIndex, 1)
                                            draft.splice(index, 0, moved)
                                            return draft
                                        })
                                        setDraggedIndex(null)
                                    }}
                                    onDragEnd={() => setDraggedIndex(null)}
                                >
                                    <div className="task-main">
                                        <p className="task-title">{goal.skill}</p>
                                        <span className={`task-inline-marker task-counter-chip ${marker}`}>
                                            {current}/{total} qs
                                        </span>
                                    </div>
                                    <div className="task-status">
                                        <span className={`status-dot ${marker}`} />
                                        <span>{goal.status === "completed" ? "Completed" : "Ongoing"}</span>
                                    </div>
                                    <div className="task-actions">
                                        <input
                                            className="task-progress-input"
                                            type="number"
                                            min="0"
                                            value={current}
                                            onChange={async (e) => {
                                                const next = Number(e.target.value || 0)
                                                try {
                                                    await updateGoal(goal._id, { currentProgress: next })
                                                    setGoals((prev) => prev.map((item) => item._id === goal._id ? { ...item, currentProgress: next } : item))
                                                    await loadOverview(selectedYear)
                                                } catch (err) {
                                                    setError(err?.response?.data?.message || "Unable to update goal.")
                                                }
                                            }}
                                        />
                                        {goal.status !== "completed" && (
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    try {
                                                        await updateGoal(goal._id, { currentProgress: total })
                                                        await loadOverview(selectedYear)
                                                    } catch (err) {
                                                        setError(err?.response?.data?.message || "Unable to complete goal.")
                                                    }
                                                }}
                                            >
                                                Mark Complete
                                            </button>
                                        )}
                                    </div>
                                    <div className="bar"><i style={{ width: `${percent}%` }} /></div>
                                </article>
                            )
                        })}
                    </div>
                    {visibleGoalTasks.length > 3 && (
                        <button type="button" className="history-more-btn goal-more-btn" onClick={() => setShowAllGoals(true)}>
                            Show More
                        </button>
                    )}
                </section>

                <section className="progress-grid compact-2">
                    <article className="progress-card glass">
                        <h3>Set Your Reminder</h3>
                        <label>Reminder Time
                            <input className="reminder-time-input" type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} />
                        </label>
                        <label>Notification channel
                            <select value={reminderType} onChange={(e) => setReminderType(e.target.value)}>
                                <option value="in_app">In-app</option>
                                <option value="email">Email</option>
                                <option value="both">Both</option>
                            </select>
                        </label>
                        <button type="button" className="generate-btn compact" onClick={saveReminderHandler} disabled={saving}>Save Reminder</button>
                    </article>

                    <article className="progress-card glass">
                        <h3>Completed Topics</h3>
                        <div className="topic-history">
                            {!previewCompletedGoals.length && <p className="notes-meta">No completed topics yet.</p>}
                            {previewCompletedGoals.map((goal) => (
                                <article key={goal._id} className="topic-item">
                                    <strong>{goal.skill}</strong>
                                    <small>{new Date(goal.completedAt).toLocaleDateString()}</small>
                                </article>
                            ))}
                        </div>
                        {completedGoals.length > 3 && (
                            <button
                                type="button"
                                className="history-more-btn goal-more-btn"
                                onClick={() => setShowAllCompletedTopics(true)}
                            >
                                Show More
                            </button>
                        )}
                    </article>
                </section>

                <section className="progress-grid compact-3">
                    <article className="progress-card stat-tile glass">
                        <h3>Goals Completed</h3>
                        <p className="big">{stats?.goalsSummary?.completed || 0}/{stats?.goalsSummary?.total || 0}</p>
                    </article>
                    <article className="progress-card stat-tile glass">
                        <h3>Completion Trend</h3>
                        <p className="big">
                            <span className={`trend-chip ${trendClass}`}>
                                <span className={`trend-icon ${trendClass}`} aria-hidden="true">
                                    <svg viewBox="0 0 24 24" fill="none">
                                        {trendPercent >= 0
                                            ? <path d="M6 14L11 9L14.5 12.5L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            : <path d="M6 10L11 15L14.5 11.5L18 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
                                    </svg>
                                </span>
                                {Math.abs(trendPercent)}%
                            </span>
                        </p>
                        <p className="notes-meta">Compared to previous week.</p>
                    </article>
                    <article className="progress-card stat-tile glass">
                        <h3>Current Streak</h3>
                        <p className="big">{stats?.streak?.current || 0} days</p>
                    </article>
                </section>

                <section className="progress-card heatmap-card glass">
                    <div className="heatmap-head">
                        <h3>{yearHeatmap.totalSubmissions} goals completed in {selectedYear}</h3>
                        <div className="heatmap-head__right">
                            <span>Total active days: {yearHeatmap.totalActiveDays}</span>
                            <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
                                {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="calendar-strip-wrap">
                        <div
                            className="calendar-heatmap heatmap-animate"
                            key={selectedYear}
                            ref={heatmapScrollRef}
                            onScroll={(e) => setHeatmapSliderValue(e.currentTarget.scrollLeft)}
                        >
                            {yearHeatmap.months.map((month) => (
                                <article className="calendar-month" key={`${selectedYear}-${month.monthIndex}`}>
                                    <h4>
                                        {month.monthLabel}
                                        <span>{month.totalDays} days</span>
                                    </h4>
                                    <div className="calendar-month__weekdays">
                                        <span>S</span>
                                        <span>M</span>
                                        <span>T</span>
                                        <span>W</span>
                                        <span>T</span>
                                        <span>F</span>
                                        <span>S</span>
                                    </div>
                                    <div className="calendar-month__grid">
                                        {Array.from({ length: month.firstDayOffset }).map((_, idx) => (
                                            <span key={`pad-${month.monthIndex}-${idx}`} className="cell out" aria-hidden="true" />
                                        ))}
                                        {month.days.map((day) => {
                                            const intensity = Math.min(4, Math.max(0, Number(day.value || 0)))
                                            return (
                                                <span
                                                    key={day.key}
                                                    className={`cell lv-${intensity}`}
                                                    title={`${day.value} goals on ${day.key}`}
                                                />
                                            )
                                        })}
                                    </div>
                                </article>
                            ))}
                        </div>
                        {heatmapSliderMax > 0 && (
                            <div className="calendar-slider">
                                <input
                                    type="range"
                                    min="0"
                                    max={Math.ceil(heatmapSliderMax)}
                                    value={Math.min(Math.ceil(heatmapSliderValue), Math.ceil(heatmapSliderMax))}
                                    onChange={(e) => {
                                        const next = Number(e.target.value)
                                        setHeatmapSliderValue(next)
                                        if (heatmapScrollRef.current) {
                                            heatmapScrollRef.current.scrollLeft = next
                                        }
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </section>
                
                <div className="notes-flash">
                    {loading && <Loader message="Synchronizing your progress data..." style={{ minHeight: '180px', marginTop: '1rem' }} />}
                    {error && <p className="notes-error">{error}</p>}
                    {message && <p className="notes-success">{message}</p>}
                </div>
            </section>

            {showAllGoals && (
                <section className="history-modal-overlay" onClick={() => setShowAllGoals(false)}>
                    <article className="history-modal goals-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="history-modal__head">
                            <h3>All Goals</h3>
                            <button type="button" onClick={() => setShowAllGoals(false)}>Close</button>
                        </div>
                        <div className="history-modal__list">
                            {visibleGoalTasks.map((goal) => {
                                const total = Math.max(1, Number(goal.targetValue || 1))
                                const current = Number(goal.currentProgress || 0)
                                const marker = goal.status === "completed" ? "completed" : "ongoing"
                                return (
                                    <article key={goal._id} className={`task-item ${marker}`}>
                                        <div className="task-main">
                                            <p className="task-title">{goal.skill}</p>
                                            <span className={`task-inline-marker task-counter-chip ${marker}`}>
                                                {current}/{total} qs
                                            </span>
                                        </div>
                                        <div className="task-status">
                                            <span className={`status-dot ${marker}`} />
                                            <span>{goal.status === "completed" ? "Completed" : "Ongoing"}</span>
                                        </div>
                                        <div className="task-actions">
                                            <input
                                                className="task-progress-input"
                                                type="number"
                                                min="0"
                                                value={current}
                                                onChange={async (e) => {
                                                    const next = Number(e.target.value || 0)
                                                    try {
                                                        await updateGoal(goal._id, { currentProgress: next })
                                                        setGoals((prev) => prev.map((item) => item._id === goal._id ? { ...item, currentProgress: next } : item))
                                                        await loadOverview(selectedYear)
                                                    } catch (err) {
                                                        setError(err?.response?.data?.message || "Unable to update goal.")
                                                    }
                                                }}
                                            />
                                            {goal.status !== "completed" && (
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        try {
                                                            await updateGoal(goal._id, { currentProgress: total })
                                                            await loadOverview(selectedYear)
                                                        } catch (err) {
                                                            setError(err?.response?.data?.message || "Unable to complete goal.")
                                                        }
                                                    }}
                                                >
                                                    Mark Complete
                                                </button>
                                            )}
                                        </div>
                                        <div className="bar"><i style={{ width: `${Math.min(100, Math.round((current / total) * 100))}%` }} /></div>
                                    </article>
                                )
                            })}
                        </div>
                    </article>
                </section>
            )}

            {showAllCompletedTopics && (
                <section className="history-modal-overlay" onClick={() => setShowAllCompletedTopics(false)}>
                    <article className="history-modal goals-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="history-modal__head">
                            <h3>Completed Topics</h3>
                            <button type="button" onClick={() => setShowAllCompletedTopics(false)}>Close</button>
                        </div>
                        <div className="history-modal__list">
                            {!completedGoals.length && <p className="notes-meta">No completed topics yet.</p>}
                            {completedGoals.map((goal) => (
                                <article key={`done-${goal._id}`} className="topic-item topic-item--modal">
                                    <strong>{goal.skill}</strong>
                                    <small>{new Date(goal.completedAt).toLocaleString()}</small>
                                </article>
                            ))}
                        </div>
                    </article>
                </section>
            )}
        </main>
    )
}

export default ProgressTracker

