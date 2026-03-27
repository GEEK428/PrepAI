import { useContext } from "react";
import { AuthContext } from "../auth.context";
import { login, register, logout, googleLogin, forgotPassword, verifyResetToken, resetPassword, updateSettings, changePassword, deleteAccount } from "../services/auth.api";



export const useAuth = () => {

    const context = useContext(AuthContext)
    const { user, setUser, loading, setLoading } = context


    const handleLogin = async ({ email, password }) => {
        setLoading(true)
        try {
            const data = await login({ email, password })
            setUser(data.user)
            return { ok: true, data }
        } catch (err) {
            return {
                ok: false,
                message: err?.response?.data?.message || "Unable to login. Please try again."
            }
        } finally {
            setLoading(false)
        }
    }

    const handleRegister = async ({ username, email, password }) => {
        setLoading(true)
        try {
            const data = await register({ username, email, password })
            return { ok: true, data }
        } catch (err) {
            return {
                ok: false,
                message: err?.response?.data?.message || "Unable to register. Please try again."
            }
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        setLoading(true)
        try {
            await logout()
            setUser(null)
            return { ok: true }
        } catch (err) {
            return {
                ok: false,
                message: err?.response?.data?.message || "Unable to logout. Please try again."
            }
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleLogin = async ({ credential }) => {
        setLoading(true)
        try {
            const data = await googleLogin({ credential })
            setUser(data.user)
            return { ok: true, data }
        } catch (err) {
            return {
                ok: false,
                message: err?.response?.data?.message || "Unable to login with Google. Please try again."
            }
        } finally {
            setLoading(false)
        }
    }

    const handleForgotPassword = async ({ email, password, confirmPassword }) => {
        setLoading(true)
        try {
            const data = await forgotPassword({ email, password, confirmPassword })
            return { ok: true, data }
        } catch (err) {
            return {
                ok: false,
                message: err?.response?.data?.message || "Unable to update password. Please try again."
            }
        } finally {
            setLoading(false)
        }
    }

    const handleVerifyResetToken = async ({ token }) => {
        setLoading(true)
        try {
            const data = await verifyResetToken({ token })
            return { ok: true, data }
        } catch (err) {
            return {
                ok: false,
                message: err?.response?.data?.message || "Reset link is invalid or expired."
            }
        } finally {
            setLoading(false)
        }
    }

    const handleResetPassword = async ({ token, password }) => {
        setLoading(true)
        try {
            const data = await resetPassword({ token, password })
            setUser(null)
            return { ok: true, data }
        } catch (err) {
            return {
                ok: false,
                message: err?.response?.data?.message || "Unable to reset password. Please try again."
            }
        } finally {
            setLoading(false)
        }
    }

    const handleUpdateSettings = async ({
        fullName,
        bio,
        preferences,
        avatarDataUrl,
        experienceLevel,
        targetJob,
        targetCompany
    }) => {
        setLoading(true)
        try {
            const data = await updateSettings({
                fullName,
                bio,
                preferences,
                avatarDataUrl,
                experienceLevel,
                targetJob,
                targetCompany
            })
            setUser(data.user)
            return { ok: true, data }
        } catch (err) {
            return {
                ok: false,
                message: err?.response?.data?.message || "Unable to update settings. Please try again."
            }
        } finally {
            setLoading(false)
        }
    }

    const handleChangePassword = async ({ currentPassword, newPassword }) => {
        setLoading(true)
        try {
            const data = await changePassword({ currentPassword, newPassword })
            setUser(null)
            return { ok: true, data }
        } catch (err) {
            return {
                ok: false,
                message: err?.response?.data?.message || "Unable to change password. Please try again."
            }
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteAccount = async ({ password }) => {
        setLoading(true)
        try {
            const data = await deleteAccount({ password })
            setUser(null)
            return { ok: true, data }
        } catch (err) {
            return {
                ok: false,
                message: err?.response?.data?.message || "Unable to delete account. Please try again."
            }
        } finally {
            setLoading(false)
        }
    }

    return {
        user,
        loading,
        handleRegister,
        handleLogin,
        handleGoogleLogin,
        handleLogout,
        handleForgotPassword,
        handleVerifyResetToken,
        handleResetPassword,
        handleUpdateSettings,
        handleChangePassword,
        handleDeleteAccount
    }
}
