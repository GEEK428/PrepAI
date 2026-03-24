import React, { useState } from "react"
import { Link } from "react-router"
import "../auth.form.scss"
import { useAuth } from "../hooks/useAuth"
import { ArrowLeftIcon, EmailIcon, SparkIcon } from "../components/AuthIcons"

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const ForgotPassword = () => {
    const { loading, handleForgotPassword } = useAuth()
    const [email, setEmail] = useState("")
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

        const result = await handleForgotPassword({ email: normalizedEmail })
        if (!result?.ok) {
            setError(result?.message || "Unable to process request.")
            return
        }

        setSuccessMessage(result?.data?.message || "If this email is registered, reset instructions have been sent.")
    }

    return (
        <main className="auth-page auth-page--forgot">
            <div className="auth-shell">
                <section className="auth-hero">
                    <div className="brand-row">
                        <img className='brand-mark' src='/mind-icon.svg' alt='IntelliPrep logo' />
                        <h2>IntelliPrep</h2>
                    </div>

                    <h1>Forgot your password?</h1>
                    <p className="hero-copy">Enter your registered email and we will send a reset link.</p>
                </section>

                <section className="auth-panel">
                    <p className="back-link-row">
                        <Link to="/login"><ArrowLeftIcon />Back to login</Link>
                    </p>

                    <h2 className="panel-title"><SparkIcon />Reset Password</h2>
                    <p className="auth-subtitle">Use your email to receive reset instructions.</p>

                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <label htmlFor="email">
                                <span className="label-with-icon"><EmailIcon />Email Address</span>
                            </label>
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

                        <button className="button primary-button login-btn" disabled={loading}>
                            {loading ? "Sending..." : "Send reset instructions"}
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
