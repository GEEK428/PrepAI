import React, { useState } from "react"
import { Link } from "react-router"
import "../auth.form.scss"
import { useAuth } from "../hooks/useAuth"

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/

const ForgotPassword = () => {
    const { loading, handleForgotPassword } = useAuth()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [error, setError] = useState("")
    const [successMessage, setSuccessMessage] = useState("")

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError("")
        setSuccessMessage("")

        const normalizedEmail = email.trim().toLowerCase()
        if (!emailRegex.test(normalizedEmail)) {
            setError("Enter a valid email address in this format: name@example.com")
            return
        }

        if (!passwordRegex.test(password)) {
            setError("Password must be at least 8 characters and include uppercase, lowercase, number, and special character.")
            return
        }

        if (password !== confirmPassword) {
            setError("New password and confirm password must match.")
            return
        }

        const result = await handleForgotPassword({
            email: normalizedEmail,
            password,
            confirmPassword
        })
        if (!result?.ok) {
            setError(result?.message || "Unable to process request.")
            return
        }

        setSuccessMessage(result?.data?.message || "Password updated successfully. Please login with your new password.")
        setPassword("")
        setConfirmPassword("")
    }

    return (
        <main className="auth-page auth-page--forgot">
            <div className="auth-shell">
                <section className="auth-hero">
                    <div className="brand-row">
                        <img className='brand-mark' src='/mind-icon.svg' alt='IntelliPrep logo' />
                        <h2>IntelliPrep</h2>
                    </div>

                    <h1>Reset your password</h1>
                    <p className="hero-copy">Enter your email and set a new password right away.</p>
                </section>

                <section className="auth-panel">
                    <p className="back-link-row">
                        <Link to="/login">
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_back</span>
                            Back to login
                        </Link>
                    </p>

                    <h2 className="panel-title">Reset Password</h2>
                    <p className="auth-subtitle">Temporary flow: update password directly for email-password accounts.</p>

                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <label htmlFor="email">
                                EMAIL ADDRESS
                            </label>
                            <div className="input-wrapper">
                                <span className="material-symbols-outlined input-icon">mail</span>
                                <input
                                    onChange={(e) => {
                                        setEmail(e.target.value)
                                    }}
                                    type="email"
                                    id="email"
                                    name="email"
                                    placeholder="name@example.com"
                                    pattern="^[^\s@]+@[^\s@]+\.[^\s@]{2,}$"
                                    title="Use a valid email address like name@example.com"
                                    required
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label htmlFor="password">
                                NEW PASSWORD
                            </label>
                            <div className="input-wrapper">
                                <span className="material-symbols-outlined input-icon">lock</span>
                                <input
                                    onChange={(e) => setPassword(e.target.value)}
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
                                    <span className="material-symbols-outlined">
                                        {showPassword ? "visibility_off" : "visibility"}
                                    </span>
                                </button>
                            </div>
                        </div>

                        <div className="input-group">
                            <label htmlFor="confirmPassword">
                                CONFIRM PASSWORD
                            </label>
                            <div className="input-wrapper">
                                <span className="material-symbols-outlined input-icon">lock</span>
                                <input
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    type={showConfirmPassword ? "text" : "password"}
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    placeholder="Re-enter new password"
                                    required
                                />
                                <button
                                    type="button"
                                    className="eye-btn"
                                    onClick={() => setShowConfirmPassword((v) => !v)}
                                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                                >
                                    <span className="material-symbols-outlined">
                                        {showConfirmPassword ? "visibility_off" : "visibility"}
                                    </span>
                                </button>
                            </div>
                        </div>

                        <button className="button primary-button login-btn" disabled={loading}>
                            {loading ? "Updating..." : "Update password"}
                        </button>
                    </form>

                    {error && <p className="auth-error">{error}</p>}
                    {successMessage && <p className="auth-success">{successMessage}</p>}
                </section>
            </div>
        </main>
    )
}

export default ForgotPassword
