import axios from "axios"

const api = axios.create({
    baseURL: "http://localhost:3000",
    withCredentials: true
})

export const getNotes = async ({ view = "all", search = "", domain = "" } = {}) => {
    const response = await api.get("/api/notes", {
        params: { view, search, domain }
    })
    return response.data
}

export const createNote = async (payload) => {
    const response = await api.post("/api/notes", payload)
    return response.data
}

export const updateNote = async (noteId, payload) => {
    const response = await api.patch(`/api/notes/${noteId}`, payload)
    return response.data
}

export const deleteNote = async (noteId) => {
    const response = await api.delete(`/api/notes/${noteId}`)
    return response.data
}

export const exportNotesPdf = async (noteIds = []) => {
    const response = await api.post("/api/notes/export/pdf", { noteIds }, { responseType: "blob" })
    return response.data
}

export const generateAiAnswer = async ({ domain, subdomain, question, sourceTag = "", difficulty = "medium" }) => {
    const response = await api.post("/api/notes/ai-answer", { domain, subdomain, question, sourceTag, difficulty })
    return response.data
}

export const importNotesPdf = async (file) => {
    const formData = new FormData()
    formData.append("file", file)
    const response = await api.post("/api/notes/import/pdf", formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        }
    })
    return response.data
}
