import axios from "axios"

const api = axios.create({
    baseURL: "http://localhost:3000",
    withCredentials: true
})

export const getProgressOverview = async (year) => {
    const response = await api.get("/api/progress/overview", {
        params: year ? { year } : {}
    })
    return response.data
}

export const saveAssessment = async (skills) => {
    const response = await api.post("/api/progress/assessment", { skills })
    return response.data
}

export const createGoal = async (payload) => {
    const response = await api.post("/api/progress/goals", payload)
    return response.data
}

export const updateGoal = async (goalId, payload) => {
    const response = await api.patch(`/api/progress/goals/${goalId}`, payload)
    return response.data
}

export const deleteGoal = async (goalId) => {
    const response = await api.delete(`/api/progress/goals/${goalId}`)
    return response.data
}

export const saveRoadmap = async ({ days, reminderTime, reminderType, weekStartDate }) => {
    const response = await api.post("/api/progress/roadmap", { days, reminderTime, reminderType, weekStartDate })
    return response.data
}

export const saveReminders = async ({ reminderTime, reminderType, weekStartDate }) => {
    const response = await api.patch("/api/progress/reminders", { reminderTime, reminderType, weekStartDate })
    return response.data
}

export const saveCheckin = async (payload) => {
    const response = await api.post("/api/progress/checkin", payload)
    return response.data
}

export const getNotifications = async () => {
    const response = await api.get("/api/progress/notifications")
    return response.data
}

export const markNotificationRead = async (notificationId) => {
    const response = await api.patch(`/api/progress/notifications/${notificationId}/read`)
    return response.data
}

export const markAllNotificationsRead = async () => {
    const response = await api.patch("/api/progress/notifications/read-all")
    return response.data
}

export const getProgressStats = async (year) => {
    const response = await api.get("/api/progress/stats", {
        params: year ? { year } : {}
    })
    return response.data
}
