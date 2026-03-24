import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router'
import "../auth.form.scss"
import { useAuth } from '../hooks/useAuth'
import { EmailIcon, LockIcon, SparkIcon } from '../components/AuthIcons'
import Loader from '../../../components/Loader'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const Login = () => {
    const { loading, handleLogin, handleGoogleLogin } = useAuth()
    const navigate = useNavigate()

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState("")
    const googleBtnRef = useRef(null)

    useEffect(() => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
        if (!clientId) {
            return
        }

        const initializeGoogle = () => {
            if (!window.google?.accounts?.id) {
                return
            }

            window.google.accounts.id.initialize({
                client_id: clientId,
                callback: async (response) => {
                    setError("")
                    const result = await handleGoogleLogin({ credential: response.credential })
                    if (result?.ok) {
                        navigate("/dashboard")
                        return
                    }
                    setError(result?.message || "Unable to login with Google.")
                }
            })

            if (googleBtnRef.current) {
                window.google.accounts.id.renderButton(googleBtnRef.current, {
                    theme: "outline",
                    size: "large",
                    text: "continue_with",
                    shape: "pill",
                    width: "320"
                })
            }
        }

        if (window.google?.accounts?.id) {
            initializeGoogle()
            return
        }

        const script = document.createElement("script")
        script.src = "https://accounts.google.com/gsi/client"
        script.async = true
        script.defer = true
        script.onload = initializeGoogle
        document.body.appendChild(script)
    }, [handleGoogleLogin, navigate])

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError("")

        const normalizedEmail = email.trim().toLowerCase()
        if (!emailRegex.test(normalizedEmail)) {
            setError("Enter a valid email address in this format: name@example.com")
            return
        }

        const result = await handleLogin({ email: normalizedEmail, password })
        if (result?.ok) {
            navigate('/dashboard')
            return
        }
        setError(result?.message || "Login failed.")
    }

    if (loading) {
        return (<main className="auth-page"><Loader message="Logging you in..." /></main>)
    }

    return (
        <main className='auth-page auth-page--login'>
            <div className="auth-shell">
                <section className="auth-hero">
                    <div className='brand-row'>
                        <img className='brand-mark' src='/mind-icon.svg' alt='IntelliPrep logo' />
                        <h2>IntelliPrep</h2>
                    </div>

                    <h1>Crack Interviews <span className='highlight'>with AI</span></h1>

                    <div className='hero-points hero-points--cards'>
                        <p>Get real interview questions</p>
                        <p>Identify skill gaps</p>
                        <p>Generate ATS-ready resumes</p>
                    </div>
                </section>

                <section className="auth-panel">
                    <h2 className='panel-title'><SparkIcon />Sign In</h2>
                    <p className='auth-subtitle'>All-in-One Platform for Interview Success.</p>

                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <label htmlFor="email">
                                <span className='label-with-icon'><EmailIcon />Email Address</span>
                            </label>
                            <input
                                onChange={(e) => { setEmail(e.target.value) }}
                                type="email"
                                id="email"
                                name='email'
                                placeholder='name@example.com'
                                pattern="^[^\s@]+@[^\s@]+\.[^\s@]{2,}$"
                                title="Use a valid email address like name@example.com"
                                required
                            />
                        </div>

                        <div className="input-group">
                            <label htmlFor="password">
                                <span className='label-with-icon'><LockIcon />Password</span>
                            </label>
                            <div className='password-field'>
                                <input
                                    onChange={(e) => { setPassword(e.target.value) }}
                                    type={showPassword ? "text" : "password"}
                                    id="password"
                                    name='password'
                                    placeholder='Enter password'
                                    required
                                />
                                <button
                                    type='button'
                                    className='eye-btn'
                                    onClick={() => setShowPassword((v) => !v)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? "Hide" : "Show"}
                                </button>
                            </div>
                        </div>

                        <div className='form-row'>
                            <label className='show-pass'>
                                <input
                                    type='checkbox'
                                    checked={showPassword}
                                    onChange={() => setShowPassword((v) => !v)}
                                />
                                Show Password
                            </label>
                            <Link to='/forgot-password'>Forgot Password?</Link>
                        </div>

                        <button className='button primary-button login-btn'>Secure Login</button>
                    </form>

                    <div className='oauth-divider'><span>or continue with</span></div>
                    <div className='google-login-wrap' ref={googleBtnRef}></div>

                    {error && <p className='auth-error'>{error}</p>}

                    <p className='auth-footer-text'>
                        Don't have an account? <Link to={'/register'}>Register</Link>
                    </p>
                </section>
            </div>
        </main>
    )
}

export default Login
