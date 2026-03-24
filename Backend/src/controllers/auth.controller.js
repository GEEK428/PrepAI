const userModel = require("../models/user.model")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const crypto = require("crypto")
const nodemailer = require("nodemailer")
const tokenBlacklistModel = require("../models/blacklist.model")
const interviewReportModel = require("../models/interviewReport.model")
const { noteModel } = require("../models/note.model")
const goalModel = require("../models/goal.model")
const roadmapModel = require("../models/roadmap.model")
const progressLogModel = require("../models/progressLog.model")
const { progressProfileModel } = require("../models/progressProfile.model")
const notificationModel = require("../models/notification.model")
const pendingUserModel = require("../models/pendingUser.model")
const { OAuth2Client } = require("google-auth-library")

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

async function generateUniqueUsername(seed = "user") {
    const base = seed.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) || "user"

    for (let i = 0; i < 10; i++) {
        const randomSuffix = Math.floor(1000 + Math.random() * 9000)
        const candidate = `${base}${randomSuffix}`
        const existing = await userModel.findOne({ username: candidate }).select("_id")
        if (!existing) {
            return candidate
        }
    }

    return `${base}${Date.now().toString().slice(-6)}`
}

function buildAuthToken(user) {
    return jwt.sign(
        {
            id: user._id,
            username: user.username,
            displayName: user.username,
            tokenVersion: user.tokenVersion || 0
        },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    )
}

function buildUserResponse(user) {
    return {
        id: user._id,
        username: user.username,
        displayName: user.username,
        email: user.email,
        fullName: user.fullName || user.username,
        bio: user.bio || "",
        avatar: user.avatar || "",
        experienceLevel: user.experienceLevel || "",
        targetJob: user.targetJob || "",
        targetCompany: user.targetCompany || "",
        preferences: {
            emailNotifications: user.preferences?.emailNotifications ?? true,
            aiVoiceInterface: user.preferences?.aiVoiceInterface ?? false
        }
    }
}

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/
const ALLOWED_AVATAR_TYPES = [ "image/jpeg", "image/png", "image/webp" ]
const MAX_AVATAR_BYTES = 2 * 1024 * 1024

function parseAvatarDataUrl(avatarDataUrl = "") {
    if (!avatarDataUrl) {
        return { avatar: "" }
    }

    if (typeof avatarDataUrl !== "string") {
        throw new Error("Invalid avatar format.")
    }

    const match = avatarDataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/)
    if (!match) {
        throw new Error("Avatar must be JPEG, PNG, or WEBP.")
    }

    const mimeType = match[1]
    if (!ALLOWED_AVATAR_TYPES.includes(mimeType)) {
        throw new Error("Avatar file type is not supported.")
    }

    const byteSize = Buffer.byteLength(match[2], "base64")
    if (byteSize > MAX_AVATAR_BYTES) {
        throw new Error("Avatar size must be 2MB or less.")
    }

    return { avatar: avatarDataUrl }
}

function hashResetToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex")
}

async function sendForgotPasswordEmail({ email, resetUrl }) {
    const {
        SMTP_HOST,
        SMTP_PORT,
        SMTP_USER,
        SMTP_PASS,
        SMTP_FROM
    } = process.env

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
        console.log(`[ForgotPassword] SMTP not configured. Reset URL for ${email}: ${resetUrl}`)
        return
    }

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS
        }
    })

    await transporter.sendMail({
        from: SMTP_FROM || SMTP_USER,
        to: email,
        subject: "Reset your IntelliPrep password",
        text: `Use this link to reset your password: ${resetUrl}\n\nThis link expires in 15 minutes.`,
        html: `
            <div style="font-family: Arial, sans-serif; color: #111;">
                <h2>Reset your IntelliPrep password</h2>
                <p>We received a request to reset your password.</p>
                <p>
                    <a href="${resetUrl}" target="_blank" rel="noopener noreferrer">Reset Password</a>
                </p>
                <p>This link expires in 15 minutes.</p>
                <p>If you did not request this, you can ignore this email.</p>
            </div>
        `
    })
}

async function sendVerificationEmail({ email, verifyUrl }) {
    const {
        SMTP_HOST,
        SMTP_PORT,
        SMTP_USER,
        SMTP_PASS,
        SMTP_FROM
    } = process.env

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
        console.log(`[VerifyEmail] SMTP not configured. Verify URL for ${email}: ${verifyUrl}`)
        return
    }

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS
        }
    })

    await transporter.sendMail({
        from: SMTP_FROM || SMTP_USER,
        to: email,
        subject: "Verify your IntelliPrep account",
        text: `Welcome! Use this link to verify your email: ${verifyUrl}\n\nThis link expires in 24 hours.`,
        html: `
            <div style="font-family: Arial, sans-serif; color: #111;">
                <h2>Welcome to IntelliPrep!</h2>
                <p>Please verify your email address to complete your registration.</p>
                <p>
                    <a href="${verifyUrl}" target="_blank" rel="noopener noreferrer"
                       style="display:inline-block;padding:10px 24px;background:#569bcd;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;"
                    >Verify Email</a>
                </p>
                <p>This link expires in 24 hours.</p>
                <p>If you did not create an account, you can ignore this email.</p>
            </div>
        `
    })
}

/**
 * @name registerUserController
 * @description register a new user, expects username, email and password in the request body
 * @access Public
 */
async function registerUserController(req, res) {

    const { username, email, password } = req.body
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
    const normalizedEmail = email?.trim().toLowerCase()

    if (!username || !normalizedEmail || !password) {
        return res.status(400).json({
            message: "Please provide username, email and password"
        })
    }

    if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({
            message: "Please provide a valid email address in this format: name@example.com"
        })
    }

    if (!passwordRegex.test(password)) {
        return res.status(400).json({
            message: "Password must be at least 8 characters and include uppercase, lowercase, number, and special character."
        })
    }

    const isUserAlreadyExists = await userModel.findOne({
        $or: [ { username }, { email: normalizedEmail } ]
    })

    if (isUserAlreadyExists) {
        return res.status(400).json({
            message: "Account already exists with this email address or username"
        })
    }

    const hash = await bcrypt.hash(password, 10)

    const rawVerifyToken = crypto.randomBytes(32).toString("hex")
    const hashedVerifyToken = hashResetToken(rawVerifyToken)

    // Remove any previous pending registration for same email
    await pendingUserModel.deleteMany({ email: normalizedEmail })

    await pendingUserModel.create({
        username,
        email: normalizedEmail,
        password: hash,
        verifyToken: hashedVerifyToken
    })

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173"
    const verifyUrl = `${frontendUrl}/verify-email/${rawVerifyToken}`

    await sendVerificationEmail({
        email: normalizedEmail,
        verifyUrl
    })

    res.status(201).json({
        message: "Please check your email to verify your account and complete registration."
    })

}


/**
 * @name loginUserController
 * @description login a user, expects email and password in the request body
 * @access Public
 */
async function loginUserController(req, res) {

    const { email, password } = req.body
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
    const normalizedEmail = email?.trim().toLowerCase()

    if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
        return res.status(400).json({
            message: "Please provide a valid email address in this format: name@example.com"
        })
    }

    const user = await userModel.findOne({ email: normalizedEmail })

    if (!user) {
        return res.status(400).json({
            message: "Invalid email or password"
        })
    }

    if (user.authProvider === "google") {
        return res.status(400).json({
            message: "This account uses Google sign-in. Please continue with Google."
        })
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
        return res.status(400).json({
            message: "Invalid email or password"
        })
    }

    const token = buildAuthToken(user)

    res.cookie("token", token)
    res.status(200).json({
        message: "User loggedIn successfully.",
        user: buildUserResponse(user)
    })
}

/**
 * @name googleAuthController
 * @description login/register using Google ID token.
 * @access Public
 */
async function googleAuthController(req, res) {
    const { credential } = req.body
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

    if (!credential) {
        return res.status(400).json({
            message: "Google credential is required."
        })
    }

    const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID
    })

    const payload = ticket.getPayload()
    const email = payload?.email?.trim().toLowerCase()
    const googleId = payload?.sub
    const googleName = payload?.name?.trim()
    const isEmailVerified = payload?.email_verified

    if (!email || !googleId || !isEmailVerified) {
        return res.status(400).json({
            message: "Invalid Google account."
        })
    }

    if (!emailRegex.test(email)) {
        return res.status(400).json({
            message: "Please use a valid email account to continue."
        })
    }

    let user = await userModel.findOne({
        $or: [ { googleId }, { email } ]
    })

    if (!user) {
        const usernameSeed = googleName || email.split("@")[ 0 ]
        const username = await generateUniqueUsername(usernameSeed)

        user = await userModel.create({
            username,
            email,
            authProvider: "google",
            googleId,
            isVerified: true
        })
    } else if (!user.googleId) {
        user.googleId = googleId
        user.authProvider = "google"
        await user.save()
    }

    const token = buildAuthToken(user)

    res.cookie("token", token)
    res.status(200).json({
        message: "Google sign-in successful.",
        user: buildUserResponse(user)
    })
}


/**
 * @name logoutUserController
 * @description clear token from user cookie and add the token in blacklist
 * @access public
 */
async function logoutUserController(req, res) {
    const token = req.cookies.token

    if (token) {
        await tokenBlacklistModel.create({ token })
    }

    res.clearCookie("token")

    res.status(200).json({
        message: "User logged out successfully"
    })
}

/**
 * @name getMeController
 * @description get the current logged in user details.
 * @access private
 */
async function getMeController(req, res) {

    const user = await userModel.findById(req.user.id)



    res.status(200).json({
        message: "User details fetched successfully",
        user: buildUserResponse(user)
    })

}

/**
 * @name updateSettingsController
 * @description update profile and preference settings for logged in user.
 * @access private
 */
async function updateSettingsController(req, res) {
    const {
        fullName,
        bio,
        preferences,
        avatarDataUrl,
        experienceLevel,
        targetJob,
        targetCompany
    } = req.body || {}
    const user = await userModel.findById(req.user.id)

    if (!user) {
        return res.status(404).json({
            message: "User not found."
        })
    }

    if (typeof fullName === "string") {
        user.fullName = fullName.trim().slice(0, 80)
    }

    if (typeof bio === "string") {
        user.bio = bio.trim().slice(0, 400)
    }

    if (typeof experienceLevel === "string") {
        const normalizedLevel = experienceLevel.trim().toLowerCase()
        const allowedLevels = [ "", "fresher", "2-5 yrs", "senior" ]
        if (!allowedLevels.includes(normalizedLevel)) {
            return res.status(400).json({
                message: "Experience level must be one of: fresher, 2-5 yrs, senior."
            })
        }
        user.experienceLevel = normalizedLevel
    }

    if (typeof targetJob === "string") {
        user.targetJob = targetJob.trim().slice(0, 120)
    }

    if (typeof targetCompany === "string") {
        user.targetCompany = targetCompany.trim().slice(0, 120)
    }

    if (avatarDataUrl !== undefined) {
        try {
            const { avatar } = parseAvatarDataUrl(avatarDataUrl)
            user.avatar = avatar
        } catch (error) {
            return res.status(400).json({
                message: error.message || "Invalid avatar."
            })
        }
    }

    if (preferences && typeof preferences === "object") {
        if (typeof preferences.emailNotifications === "boolean") {
            user.preferences.emailNotifications = preferences.emailNotifications
        }
        if (typeof preferences.aiVoiceInterface === "boolean") {
            user.preferences.aiVoiceInterface = preferences.aiVoiceInterface
        }
    }

    await user.save()

    return res.status(200).json({
        message: "Settings updated successfully.",
        user: buildUserResponse(user)
    })
}

/**
 * @name changePasswordController
 * @description change account password for the current user.
 * @access private
 */
async function changePasswordController(req, res) {
    const { currentPassword, newPassword } = req.body || {}
    const user = await userModel.findById(req.user.id)

    if (!user) {
        return res.status(404).json({
            message: "User not found."
        })
    }

    if (!passwordRegex.test(newPassword || "")) {
        return res.status(400).json({
            message: "New password must be at least 8 characters and include uppercase, lowercase, number, and special character."
        })
    }

    const hasLocalPassword = Boolean(user.password)
    if (hasLocalPassword) {
        const isCurrentValid = await bcrypt.compare(currentPassword || "", user.password)
        if (!isCurrentValid) {
            return res.status(400).json({
                message: "Current password is incorrect."
            })
        }

        const sameAsOld = await bcrypt.compare(newPassword, user.password)
        if (sameAsOld) {
            return res.status(400).json({
                message: "New password must be different from current password."
            })
        }
    }

    user.password = await bcrypt.hash(newPassword, 10)
    user.authProvider = "local"
    user.tokenVersion = (user.tokenVersion || 0) + 1
    user.passwordResetToken = null
    user.passwordResetExpiresAt = null
    await user.save()

    const activeToken = req.cookies.token
    if (activeToken) {
        await tokenBlacklistModel.create({ token: activeToken })
    }
    res.clearCookie("token")

    return res.status(200).json({
        message: "Password changed successfully. Please login again."
    })
}

/**
 * @name deleteAccountController
 * @description delete current user account and related reports.
 * @access private
 */
async function deleteAccountController(req, res) {
    const { password } = req.body || {}
    const user = await userModel.findById(req.user.id)

    if (!user) {
        return res.status(404).json({
            message: "User not found."
        })
    }

    if (user.password) {
        const validPassword = await bcrypt.compare(password || "", user.password)
        if (!validPassword) {
            return res.status(400).json({
                message: "Password is required to delete this account."
            })
        }
    }

    await interviewReportModel.deleteMany({ user: user._id })
    await noteModel.deleteMany({ user: user._id })
    await goalModel.deleteMany({ user: user._id })
    await roadmapModel.deleteMany({ user: user._id })
    await progressLogModel.deleteMany({ user: user._id })
    await progressProfileModel.deleteMany({ user: user._id })
    await notificationModel.deleteMany({ user: user._id })
    await userModel.deleteOne({ _id: user._id })

    const activeToken = req.cookies.token
    if (activeToken) {
        await tokenBlacklistModel.create({ token: activeToken })
    }
    res.clearCookie("token")

    return res.status(200).json({
        message: "Account deleted successfully."
    })
}

/**
 * @name forgotPasswordController
 * @description issue a reset token for local-password accounts and send reset email.
 * @access Public
 */
async function forgotPasswordController(req, res) {
    const { email } = req.body
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
    const normalizedEmail = email?.trim().toLowerCase()

    if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
        return res.status(400).json({
            message: "Please provide a valid email address in this format: name@example.com"
        })
    }

    const user = await userModel.findOne({ email: normalizedEmail })
    const genericResponse = {
        message: "If this email is registered, reset instructions have been sent."
    }

    if (!user) {
        return res.status(200).json(genericResponse)
    }

    if (user.authProvider === "google" && !user.password) {
        return res.status(200).json(genericResponse)
    }

    const rawResetToken = crypto.randomBytes(32).toString("hex")
    const hashedResetToken = hashResetToken(rawResetToken)
    const expiresAt = new Date(Date.now() + (15 * 60 * 1000))

    user.passwordResetToken = hashedResetToken
    user.passwordResetExpiresAt = expiresAt
    await user.save()

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173"
    const resetUrl = `${frontendUrl}/reset-password/${rawResetToken}`

    await sendForgotPasswordEmail({
        email: user.email,
        resetUrl
    })

    return res.status(200).json(genericResponse)
}

/**
 * @name verifyResetTokenController
 * @description validate reset token and expiry.
 * @access Public
 */
async function verifyResetTokenController(req, res) {
    const { token } = req.params
    const hashedToken = hashResetToken(token)
    const user = await userModel.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpiresAt: { $gt: new Date() }
    }).select("_id")

    if (!user) {
        return res.status(400).json({
            message: "Reset link is invalid or expired."
        })
    }

    return res.status(200).json({
        message: "Reset link is valid."
    })
}

/**
 * @name resetPasswordController
 * @description reset password using valid token.
 * @access Public
 */
async function resetPasswordController(req, res) {
    const { token } = req.params
    const { password } = req.body
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/

    if (!passwordRegex.test(password || "")) {
        return res.status(400).json({
            message: "Password must be at least 8 characters and include uppercase, lowercase, number, and special character."
        })
    }

    const hashedToken = hashResetToken(token)
    const user = await userModel.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpiresAt: { $gt: new Date() }
    })

    if (!user) {
        return res.status(400).json({
            message: "Reset link is invalid or expired."
        })
    }

    user.password = await bcrypt.hash(password, 10)
    user.authProvider = "local"
    user.passwordResetToken = null
    user.passwordResetExpiresAt = null
    user.tokenVersion = (user.tokenVersion || 0) + 1
    await user.save()

    const activeToken = req.cookies.token
    if (activeToken) {
        await tokenBlacklistModel.create({ token: activeToken })
    }
    res.clearCookie("token")

    return res.status(200).json({
        message: "Password reset successful. Please login again."
    })
}



/**
 * @name verifyEmailController
 * @description verify a user's email address using a token from the verification email.
 * @access Public
 */
async function verifyEmailController(req, res) {
    const { token } = req.params
    const hashedToken = hashResetToken(token)

    const pending = await pendingUserModel.findOne({
        verifyToken: hashedToken
    })

    if (!pending) {
        return res.status(400).json({
            message: "Verification link is invalid or has expired."
        })
    }

    // Check if user was already created (duplicate click)
    const existingUser = await userModel.findOne({ email: pending.email })
    if (existingUser) {
        await pendingUserModel.deleteOne({ _id: pending._id })
        return res.status(200).json({
            message: "Email already verified. You can log in."
        })
    }

    await userModel.create({
        username: pending.username,
        email: pending.email,
        password: pending.password,
        authProvider: "local",
        isVerified: true
    })

    await pendingUserModel.deleteOne({ _id: pending._id })

    return res.status(200).json({
        message: "Email verified successfully! You can now log in."
    })
}

module.exports = {
    registerUserController,
    loginUserController,
    googleAuthController,
    forgotPasswordController,
    verifyResetTokenController,
    resetPasswordController,
    updateSettingsController,
    changePasswordController,
    deleteAccountController,
    logoutUserController,
    getMeController,
    verifyEmailController
}
