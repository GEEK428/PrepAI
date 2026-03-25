import React, { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router"
import "../auth.form.scss"
import { useAuth } from "../hooks/useAuth"
import { EmailIcon, LockIcon, SparkIcon, UserIcon } from "../components/AuthIcons"
import Loader from "../../../components/Loader"

const hasUpper = /[A-Z]/
const hasLower = /[a-z]/
const hasNumber = /\d/
const hasSpecial = /[^A-Za-z0-9]/
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const Register = () => {
    const { loading, handleRegister } = useAuth()
    const navigate = useNavigate()

    const [username, setUsername] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState("")
    const [registered, setRegistered] = useState(false)

    const passwordChecks = useMemo(() => {
        return {
            length: password.length >= 8,
            upper: hasUpper.test(password),
            lower: hasLower.test(password),
            number: hasNumber.test(password),
            special: hasSpecial.test(password),
        }
    }, [password])

    const score = Object.values(passwordChecks).filter(Boolean).length
    const strength = score <= 2 ? "weak" : score <= 4 ? "medium" : "strong"
    const isPasswordValid = score === 5

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError("")

        if (!isPasswordValid) {
            setError("Password must be at least 8 characters and include uppercase, lowercase, number, and special character.")
            return
        }

        const normalizedEmail = email.trim().toLowerCase()
        if (!emailRegex.test(normalizedEmail)) {
            setError("Enter a valid email address in this format: name@example.com")
            return
        }

        const result = await handleRegister({ username, email: normalizedEmail, password })
        if (result?.ok) {
            setRegistered(true)
            return
        }
        setError(result?.message || "Registration failed.")
    }

    if (loading) {
        return (<main className="auth-page"><Loader message="Setting up your workspace..." /></main>)
    }

    return (
        <main className="auth-page auth-page--register">
            <div className="auth-shell">
                <section className="auth-hero">
                    <div className="brand-row">
                        <img className='brand-mark' src='/mind-icon.svg' alt='IntelliPrep logo' />
                        <h2>IntelliPrep</h2>
                    </div>

                    <h1>Unlock Your <span className='highlight'>Potential</span></h1>

                    <div className='hero-points hero-points--cards'>
                        <p>Analyze your resume in seconds</p>
                        <p>Unlock structured roadmaps</p>
                        <p>Track your technical growth</p>
                    </div>
                </section>

                <section className="auth-panel">
                    <h2 className="panel-title"><SparkIcon />Create Account</h2>
                    <p className="auth-subtitle">Join the ultimate platform for interview success.</p>

                    {registered ? (
                        <div className="success-dialogue">
                            <h3>Registration Successful!</h3>
                            <p>Please check your inbox at <strong>{email}</strong> for a verification link.</p>
                            <button className="auth-btn" onClick={() => navigate('/login')}>Back to Sign In</button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            <div className="input-group">
                                <label htmlFor="username">
                                    <span className="label-with-icon"><UserIcon />Username</span>
                                </label>
                                <input
                                    onChange={(e) => setUsername(e.target.value)}
                                    type="text"
                                    id="username"
                                    name="username"
                                    placeholder="Enter your username"
                                    required
                                    minLength="3"
                                />
                            </div>

                            <div className="input-group">
                                <label htmlFor="email">
                                    <span className="label-with-icon"><EmailIcon />Email Address</span>
                                </label>
                                <input
                                    onChange={(e) => setEmail(e.target.value)}
                                    type="email"
                                    id="email"
                                    name="email"
                                    placeholder="name@example.com"
                                    pattern="^[^\s@]+@[^\s@]+\.[^\s@]{2,}$"
                                    title="Use a valid email address like name@example.com"
                                    required
                                />
                            </div>

                            <div className="input-group">
                                <label htmlFor="password">
                                    <span className="label-with-icon"><LockIcon />Secure Password</span>
                                </label>
                                <div className="password-field">
                                    <input
                                        onChange={(e) => setPassword(e.target.value)}
                                        type={showPassword ? "text" : "password"}
                                        id="password"
                                        name="password"
                                        placeholder="Create a strong password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="eye-btn"
                                        onClick={() => setShowPassword(!showPassword)}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        <span className="material-symbols-outlined">
                                            {showPassword ? "visibility_off" : "visibility"}
                                        </span>
                                    </button>
                                </div>
                                <div className="strength-row">
                                    <div className="strength-bars">
                                        <span className={score >= 1 ? `active--${strength}` : ""}></span>
                                        <span className={score >= 3 ? `active--${strength}` : ""}></span>
                                        <span className={score >= 5 ? `active--strong` : ""}></span>
                                    </div>
                                    {password.length > 0 && (
                                        <p className={`strength-label strength-label--${strength}`}>
                                            {strength === "weak" ? "Weak" : strength === "medium" ? "Good" : "Strong"}
                                        </p>
                                    )}
                                </div>
                                <ul className="password-rules">
                                    <li className={passwordChecks.length ? "met" : ""}>8+ characters</li>
                                    <li className={passwordChecks.upper && passwordChecks.lower ? "met" : ""}>Upper & lowercase</li>
                                    <li className={passwordChecks.number ? "met" : ""}>At least 1 number</li>
                                    <li className={passwordChecks.special ? "met" : ""}>At least 1 special char</li>
                                </ul>
                            </div>

                            {error && <p className="auth-error" role="alert">{error}</p>}

                            <button
                                type="submit"
                                className="auth-btn"
                                disabled={!isPasswordValid || !username || !email}
                            >
                                Get Started
                            </button>
                        </form>
                    )}

                    {!registered && (
                        <div className="auth-switch">
                            Already have an account? <Link to="/login">Sign In</Link>
                        </div>
                    )}
                </section>
            </div>
        </main>
    )
}

export default Register
