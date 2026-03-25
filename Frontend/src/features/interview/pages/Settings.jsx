import React, { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router"
import "../style/home.scss"
import "../style/settings.scss"
import { useAuth } from "../../auth/hooks/useAuth"
import Sidebar from "../components/Sidebar"
import NotificationBell from "../components/NotificationBell"

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_IMAGE_BYTES = 2 * 1024 * 1024

const Settings = () => {
    const navigate = useNavigate()
    const {
        user,
        loading,
        handleUpdateSettings,
        handleChangePassword,
        handleDeleteAccount
    } = useAuth()

    const chooseInputRef = useRef(null)
    const cameraVideoRef = useRef(null)
    const cameraCanvasRef = useRef(null)
    const streamRef = useRef(null)

    const [fullName, setFullName] = useState("")
    const [bio, setBio] = useState("")
    const [experienceLevel, setExperienceLevel] = useState("")
    const [targetJob, setTargetJob] = useState("")
    const [targetCompany, setTargetCompany] = useState("")
    const [avatarPreview, setAvatarPreview] = useState("")
    const [currentPassword, setCurrentPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [deletePassword, setDeletePassword] = useState("")
    const [message, setMessage] = useState("")
    const [error, setError] = useState("")
    const [cameraOpen, setCameraOpen] = useState(false)
    const [cameraReady, setCameraReady] = useState(false)

    useEffect(() => {
        document.title = "Settings | IntelliPrep"
    }, [])

    useEffect(() => {
        setFullName(user?.fullName || user?.username || "")
        setBio(user?.bio || "")
        setExperienceLevel(user?.experienceLevel || "")
        setTargetJob(user?.targetJob || "")
        setTargetCompany(user?.targetCompany || "")
        setAvatarPreview(user?.avatar || "")
    }, [user])

    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop())
                streamRef.current = null
            }
        }
    }, [])

    useEffect(() => {
        if (!cameraOpen || !streamRef.current) return

        const video = cameraVideoRef.current
        if (!video) return

        setCameraReady(false)
        video.srcObject = streamRef.current

        const onReady = async () => {
            try {
                await video.play()
            } catch (err) {
                setError("Unable to start camera preview.")
                return
            }
            setCameraReady(true)
        }

        if (video.readyState >= 1) {
            onReady()
        } else {
            video.onloadedmetadata = onReady
        }

        return () => {
            video.onloadedmetadata = null
            video.srcObject = null
        }
    }, [cameraOpen])

    const toDataUrl = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error("Unable to read image file."))
        reader.readAsDataURL(file)
    })

    // handleAvatarFile has been moved downward to access handleSaveProfile.

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop())
            streamRef.current = null
        }
        setCameraReady(false)
        setCameraOpen(false)
    }

    const openCamera = async () => {
        setError("")
        setMessage("")

        if (!navigator.mediaDevices?.getUserMedia) {
            setError("Camera API is not supported in this browser.")
            return
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
                audio: false
            })
            streamRef.current = stream
            setCameraOpen(true)
        } catch (err) {
            setError("Camera access denied or unavailable. You can use Update Photo.")
        }
    }

    const captureFromCamera = async () => {
        const video = cameraVideoRef.current
        const canvas = cameraCanvasRef.current
        if (!video || !canvas) return
        if (!cameraReady || !video.videoWidth || !video.videoHeight) {
            setError("Camera preview is not ready yet. Please wait a second and capture again.")
            return
        }

        const width = video.videoWidth
        const height = video.videoHeight
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        ctx.drawImage(video, 0, 0, width, height)

        const dataUrl = canvas.toDataURL("image/jpeg", 0.9)
        const byteSize = Math.ceil((dataUrl.length * 3) / 4)
        if (byteSize > MAX_IMAGE_BYTES) {
            setError("Captured image is too large. Please try again.")
            return
        }

        setAvatarPreview(dataUrl)
        stopCamera()
    }

    const handleAvatarFile = async (file) => {
        if (!file) return

        setError("")
        setMessage("")

        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            setError("Only JPG, PNG, and WEBP images are allowed.")
            return
        }

        if (file.size > MAX_IMAGE_BYTES) {
            setError("Image size must be 2MB or less.")
            return
        }

        try {
            const dataUrl = await toDataUrl(file)
            setAvatarPreview(dataUrl)
        } catch (err) {
            setError(err.message || "Unable to load selected image.")
        }
    }

    const handleRemovePhoto = async () => {
        setAvatarPreview("")
        const result = await handleUpdateSettings({
            fullName,
            bio,
            avatarDataUrl: "",
            experienceLevel,
            targetJob,
            targetCompany
        })
        if (result?.ok) {
            setMessage("Profile photo deleted.")
        } else {
            setError(result?.message || "Unable to delete photo.")
        }
    }

    const handleSaveProfile = async (forcedAvatar = null) => {
        setMessage("")
        setError("")

        const avatarToSave = forcedAvatar !== null ? forcedAvatar : (avatarPreview || "")
        const result = await handleUpdateSettings({
            fullName,
            bio,
            avatarDataUrl: avatarToSave,
            experienceLevel,
            targetJob,
            targetCompany
        })

        if (!result?.ok) {
            setError(result?.message || "Unable to save settings.")
            return
        }

        setMessage("Profile saved successfully.")
    }

    const handlePasswordSubmit = async () => {
        setMessage("")
        setError("")

        if (!newPassword.trim()) {
            setError("New password is required.")
            return
        }

        const result = await handleChangePassword({
            currentPassword,
            newPassword
        })

        if (!result?.ok) {
            setError(result?.message || "Unable to change password.")
            return
        }

        navigate("/login")
    }

    const handleDeleteSubmit = async () => {
        setMessage("")
        setError("")

        const confirmed = window.confirm("Delete your account permanently? This cannot be undone.")
        if (!confirmed) return

        const result = await handleDeleteAccount({ password: deletePassword })
        if (!result?.ok) {
            setError(result?.message || "Unable to delete account.")
            return
        }

        navigate("/login")
    }

    return (
        <main className="dashboard-page">
            <Sidebar />

            <section className="dashboard-main settings-main">
                <header className="dashboard-header">
                    <div>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.8rem', color: '#9fd0f4' }}>settings</span>
                            Settings
                        </h1>
                        <p className="dashboard-subtitle">Update your profile details, change password, or manage your account.</p>
                    </div>
                    <NotificationBell />
                </header>

                <section className="settings-grid">
                    <article className="settings-card">
                        <h3>Profile Information</h3>
                        <div className="settings-profile-row">
                            <div className="avatar-box">
                                {avatarPreview
                                    ? <img src={avatarPreview} alt="Profile avatar" />
                                    : <span>No Photo</span>}
                            </div>
                            <div className="avatar-actions">
                                <button type="button" onClick={() => chooseInputRef.current?.click()}>
                                    Choose Photo
                                </button>
                                <button type="button" onClick={openCamera}>
                                    Take Photo
                                </button>
                                <button type="button" onClick={() => handleSaveProfile()} style={{ color: '#67d7ac', borderColor: 'rgba(103, 215, 172, 0.4)', background: 'rgba(103, 215, 172, 0.1)' }}>
                                    Update
                                </button>
                                {avatarPreview && (
                                    <button type="button" className="avatar-clear-btn" onClick={handleRemovePhoto}>
                                        Delete
                                    </button>
                                )}
                                <input
                                    ref={chooseInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    style={{ display: "none" }}
                                    onChange={(e) => handleAvatarFile(e.target.files?.[0])}
                                />
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    capture="user"
                                    style={{ display: "none" }}
                                    onChange={(e) => handleAvatarFile(e.target.files?.[0])}
                                />
                            </div>
                        </div>

                        <div className="settings-form">
                            <label style={{ color: '#b7d2e8', fontWeight: '500' }}>Username</label>
                            <input value={fullName} onChange={(e) => setFullName(e.target.value)} />

                            <label style={{ color: '#b7d2e8', fontWeight: '500' }}>Email Address</label>
                            <input value={user?.email || ""} disabled style={{ color: 'rgba(234, 243, 251, 0.6)' }} />

                            <label style={{ color: '#b7d2e8', fontWeight: '500' }}>Bio</label>
                            <textarea value={bio} onChange={(e) => setBio(e.target.value)} />

                            <label style={{ color: '#b7d2e8', fontWeight: '500' }}>Experience Level</label>
                            <select value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)}>
                                <option value="">Select level</option>
                                <option value="fresher">Fresher</option>
                                <option value="2-5 yrs">2-5 yrs</option>
                                <option value="senior">Senior</option>
                            </select>

                            <label style={{ color: '#b7d2e8', fontWeight: '500' }}>Target Job</label>
                            <input
                                value={targetJob}
                                onChange={(e) => setTargetJob(e.target.value)}
                                placeholder="Example: Backend Engineer"
                            />

                            <label style={{ color: '#b7d2e8', fontWeight: '500' }}>Target Company</label>
                            <input
                                value={targetCompany}
                                onChange={(e) => setTargetCompany(e.target.value)}
                                placeholder="Example: Google"
                            />
                        </div>

                        <div className="settings-inline-actions">
                            <button type="button" onClick={() => handleSaveProfile()} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>save</span>
                                Save Profile
                            </button>
                        </div>
                    </article>

                    <article className="settings-card">
                        <h3>Change Password</h3>
                        <div className="settings-form">
                            <label style={{ color: '#b7d2e8', fontWeight: '500' }}>Current Password</label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Required for existing password accounts"
                            />

                            <label style={{ color: '#b7d2e8', fontWeight: '500' }}>New Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="At least 8 chars, upper/lower/number/symbol"
                            />
                        </div>
                        <div className="settings-inline-actions">
                            <button type="button" onClick={handlePasswordSubmit} disabled={loading}>Change Password</button>
                        </div>
                    </article>
                </section>

                <section className="settings-card danger-zone">
                    <h3>Delete Account</h3>
                    <p className="danger-copy">This permanently deletes your profile and report history.</p>
                    <div className="settings-form">
                        <label>Password Confirmation</label>
                        <input
                            type="password"
                            value={deletePassword}
                            onChange={(e) => setDeletePassword(e.target.value)}
                            placeholder="Required for local-password account"
                        />
                    </div>
                    <div className="settings-inline-actions">
                        <button type="button" className="danger-btn" onClick={handleDeleteSubmit} disabled={loading}>
                            Delete Account
                        </button>
                    </div>
                </section>

                <div className="settings-actions">
                    {error && <p className="settings-error">{error}</p>}
                    {message && <p className="settings-success">{message}</p>}
                </div>

                <footer className="dashboard-footer">
                    <a href="#" onClick={(e) => e.preventDefault()}>Privacy</a>
                    <a href="#" onClick={(e) => e.preventDefault()}>Terms</a>
                    <a href="#" onClick={(e) => e.preventDefault()}>Support</a>
                </footer>
            </section>

            {cameraOpen && (
                <section className="camera-modal-overlay" onClick={stopCamera}>
                    <article className="camera-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Capture Photo</h3>
                        <video ref={cameraVideoRef} autoPlay playsInline muted />
                        <canvas ref={cameraCanvasRef} style={{ display: "none" }} />
                        <div className="camera-actions">
                            <button type="button" onClick={captureFromCamera} disabled={!cameraReady}>Capture</button>
                            <button type="button" className="camera-cancel-btn" onClick={stopCamera}>Cancel</button>
                        </div>
                    </article>
                </section>
            )}
        </main>
    )
}

export default Settings
