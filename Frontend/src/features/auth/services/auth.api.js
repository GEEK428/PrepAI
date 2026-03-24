import axios from "axios";

const api = axios.create({
    baseURL: "http://localhost:3000",
    withCredentials: true,
});

export const register = async ({ username, email, password }) => {
    const response = await api.post("/api/auth/register", { username, email, password });
    return response.data;
};

export const login = async ({ email, password }) => {
    const response = await api.post("/api/auth/login", { email, password });
    return response.data;
};

export const googleLogin = async ({ credential }) => {
    const response = await api.post("/api/auth/google", { credential });
    return response.data;
};

export const logout = async () => {
    const response = await api.get("/api/auth/logout");
    return response.data;
};

export const getMe = async () => {
    const response = await api.get("/api/auth/get-me");
    return response.data;
};

export const updateSettings = async ({
    fullName,
    bio,
    preferences,
    avatarDataUrl,
    experienceLevel,
    targetJob,
    targetCompany
}) => {
    const response = await api.patch("/api/auth/settings", {
        fullName,
        bio,
        preferences,
        avatarDataUrl,
        experienceLevel,
        targetJob,
        targetCompany
    });
    return response.data;
};

export const changePassword = async ({ currentPassword, newPassword }) => {
    const response = await api.patch("/api/auth/change-password", { currentPassword, newPassword });
    return response.data;
};

export const deleteAccount = async ({ password }) => {
    const response = await api.delete("/api/auth/delete-account", { data: { password } });
    return response.data;
};

export const forgotPassword = async ({ email }) => {
    const response = await api.post("/api/auth/forgot-password", { email });
    return response.data;
};

export const verifyResetToken = async ({ token }) => {
    const response = await api.get(`/api/auth/reset-password/${token}/verify`);
    return response.data;
};

export const resetPassword = async ({ token, password }) => {
    const response = await api.post(`/api/auth/reset-password/${token}`, { password });
    return response.data;
};

export const verifyEmail = async ({ token }) => {
    const response = await api.get(`/api/auth/verify-email/${token}`);
    return response.data;
};
