import React, { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router'
import "../auth.form.scss"
import { verifyEmail } from '../services/auth.api'
import { SparkIcon } from '../components/AuthIcons'
import Loader from '../../../components/Loader'

const VerifyEmail = () => {
    const { token } = useParams()
    const [status, setStatus] = useState("loading")
    const [message, setMessage] = useState("")
    const hasCalledRef = useRef(false)

    useEffect(() => {
        if (!token) {
            setStatus("error")
            setMessage("Invalid verification link.")
            return
        }

        if (hasCalledRef.current) return
        hasCalledRef.current = true

        const verify = async () => {
            try {
                const data = await verifyEmail({ token })
                setStatus("success")
                setMessage(data.message || "Email verified successfully!")
            } catch (err) {
                setStatus("error")
                setMessage(
                    err?.response?.data?.message ||
                    "Verification link is invalid or has expired."
                )
            }
        }

        verify()
    }, [token])

    return (
        <main className='auth-page auth-page--login'>
            <div className="auth-shell" style={{ gridTemplateColumns: '1fr' }}>
                <section className="auth-panel" style={{ minHeight: '320px', alignItems: 'center', textAlign: 'center' }}>
                    <h2 className='panel-title' style={{ justifyContent: 'center' }}>
                        <SparkIcon />
                        {status === "loading" && "Verifying..."}
                        {status === "success" && "Email Verified!"}
                        {status === "error" && "Verification Failed"}
                    </h2>

                    {status === "loading" ? <Loader message="Verifying your digital identity..." style={{ minHeight: '180px' }} /> : (
                        <p className={status === "error" ? "auth-error" : "auth-success"} style={{ marginTop: '1rem', fontSize: '0.88rem' }}>
                           {message}
                        </p>
                    )}

                    {status === "success" && (
                        <Link to="/login" className='button primary-button login-btn' style={{ marginTop: '1.2rem', textAlign: 'center', display: 'inline-block', textDecoration: 'none', maxWidth: '240px' }}>
                            Go to Login
                        </Link>
                    )}

                    {status === "error" && (
                        <Link to="/register" className='button primary-button login-btn' style={{ marginTop: '1.2rem', textAlign: 'center', display: 'inline-block', textDecoration: 'none', maxWidth: '240px', background: 'rgba(184,211,233,0.15)', color: '#e9f2fa' }}>
                            Register Again
                        </Link>
                    )}
                </section>
            </div>
        </main>
    )
}

export default VerifyEmail
