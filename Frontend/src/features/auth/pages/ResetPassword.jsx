import React, { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import "../auth.form.scss"
import { useAuth } from "../hooks/useAuth"
import { verifyResetToken } from "../services/auth.api"
import { ArrowLeftIcon, LockIcon, SparkIcon } from "../components/AuthIcons"

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/

const ResetPassword = () => {
    const { token } = useParams()
    const navigate = useNavigate()
    const { loading, handleResetPassword } = useAuth()

    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState("")
    const [successMessage, setSuccessMessage] = useState("")
    const [isTokenValid, setIsTokenValid] = useState(null)
    const [isCheckingToken, setIsCheckingToken] = useState(true)

    useEffect(() => {
        let mounted = true

        const verifyToken = async () => {
            setError("")
            setIsCheckingToken(true)

            try {
                await verifyResetToken({ token })
                if (mounted) {
                    setIsTokenValid(true)
                }
            } catch (err) {
                if (mounted) {
                    setIsTokenValid(false)
                    setError(err?.response?.data?.message || "Reset link is invalid or expired.")
                }
            } finally {
                if (mounted) {
                    setIsCheckingToken(false)
                }
            }
        }

        verifyToken()

        return () => {
            mounted = false
        }
    }, [token])

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError("")
        setSuccessMessage("")

        if (!passwordRegex.test(password)) {
            setError("Password must be at least 8 characters and include uppercase, lowercase, number, and special character.")
            return
        }

        const result = await handleResetPassword({ token, password })
        if (!result?.ok) {
            setError(result?.message || "Unable to reset password.")
            return
        }

        setSuccessMessage(result?.data?.message || "Password reset successful. Please login again.")
        setTimeout(() => {
            navigate("/login")
        }, 1200)
    }

    return (
        <main className="auth-page auth-page--reset">
            <div className="auth-shell">
                <section className="auth-hero">
                    <div className="brand-row">
                        <img className='brand-mark' src='/mind-icon.svg' alt='IntelliPrep logo' />
                        <h2>IntelliPrep</h2>
                    </div>

                    <h1>Set a new password</h1>
                    <p className="hero-copy">Choose a strong password to secure your account.</p>
                </section>

                <section className="auth-panel">
                    <p className="back-link-row">
                        <Link to="/login"><ArrowLeftIcon />Back to login</Link>
                    </p>

                    <h2 className="panel-title"><SparkIcon />Reset Password</h2>
                    <p className="auth-subtitle">Enter a new password for your account.</p>

                    {isTokenValid === false && (
                        <div className="reset-invalid-box">
                            <p>This reset link is invalid or expired.</p>
                            <Link to="/forgot-password">Request a new reset link</Link>
                        </div>
                    )}

                    {isCheckingToken && <p className="auth-subtitle">Validating reset link...</p>}

                    {isTokenValid && (
                        <form onSubmit={handleSubmit}>
                            <div className="input-group">
                                <label htmlFor="password">
                                    <span className="label-with-icon"><LockIcon />New Password</span>
                                </label>
                                <div className="password-field">
                                    <input
                                        onChange={(e) => {
                                            setPassword(e.target.value)
                                        }}
                                        type={showPassword ? "text" : "password"}
                                        id="password"
                                        name="password"
                                        placeholder="Create new password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="eye-btn"
                                        onClick={() => setShowPassword((v) => !v)}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? "Hide" : "Show"}
                                    </button>
                                </div>
                            </div>

                            <button className="button primary-button login-btn" disabled={loading}>
                                {loading ? "Saving..." : "Save new password"}
                            </button>
                        </form>
                    )}

                    {error && <p className="auth-error">{error}</p>}
                    {successMessage && <p className="auth-success">{successMessage}</p>}
                </section>
            </div>
        </main>
    )
}

export default ResetPassword
