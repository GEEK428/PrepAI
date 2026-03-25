import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
    withCredentials: true,
})

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("intelliprep_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
})


/**
 * @description Service to generate interview report based on user self description, resume and job description.
 */
export const generateInterviewReport = async ({ jobDescription, selfDescription, resumeFile }) => {

    const formData = new FormData()
    formData.append("jobDescription", jobDescription)
    formData.append("selfDescription", selfDescription)
    if (resumeFile) {
        formData.append("resume", resumeFile)
    }

    const response = await api.post("/api/interview/", formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        }
    })

    return response.data

}


/**
 * @description Service to get interview report by interviewId.
 */
export const getInterviewReportById = async (interviewId) => {
    const response = await api.get(`/api/interview/report/${interviewId}`)

    return response.data
}

export const deleteInterviewReport = async (interviewId) => {
    const response = await api.delete(`/api/interview/report/${interviewId}`)

    return response.data
}

export const getInterviewInsights = async (interviewId) => {
    const response = await api.get(`/api/interview/report/${interviewId}/insights`)

    return response.data
}
export const getAllInterviewReports = async () => {
    const response = await api.get("/api/interview/")
    return response.data
}

export const getDashboardRadarStats = async () => {
    const response = await api.get("/api/interview/dashboard/stats")
    return response.data
}

export const generateResumePdf = async ({ interviewReportId }) => {
    const response = await api.post(`/api/interview/resume/pdf/${interviewReportId}`, null, {
        responseType: "blob"
    })

    return response.data
}
