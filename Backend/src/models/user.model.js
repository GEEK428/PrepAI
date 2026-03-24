const mongoose = require("mongoose")


const userSchema = new mongoose.Schema({
    username: {
        type: String,
        unique: [ true, "username already taken" ],
        required: true,
    },

    email: {
        type: String,
        unique: [ true, "Account already exists with this email address" ],
        required: true,
    },

    fullName: {
        type: String,
        default: ""
    },

    experienceLevel: {
        type: String,
        enum: [ "", "fresher", "2-5 yrs", "senior" ],
        default: ""
    },

    targetJob: {
        type: String,
        default: ""
    },

    targetCompany: {
        type: String,
        default: ""
    },

    bio: {
        type: String,
        default: ""
    },

    avatar: {
        type: String,
        default: ""
    },

    password: {
        type: String,
        required: function () {
            return this.authProvider === "local"
        }
    },

    authProvider: {
        type: String,
        enum: [ "local", "google" ],
        default: "local"
    },

    googleId: {
        type: String,
        unique: true,
        sparse: true
    },

    passwordResetToken: {
        type: String,
        default: null
    },

    passwordResetExpiresAt: {
        type: Date,
        default: null
    },

    tokenVersion: {
        type: Number,
        default: 0
    },

    isVerified: {
        type: Boolean,
        default: false
    },

    preferences: {
        emailNotifications: {
            type: Boolean,
            default: true
        },
        aiVoiceInterface: {
            type: Boolean,
            default: false
        }
    }
})

const userModel = mongoose.model("users", userSchema)

module.exports = userModel
