const mongoose = require("mongoose")

const SKILL_KEYS = [ "DSA", "System Design", "Development", "Behavioral", "Database" ]

const progressProfileSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true,
        unique: true
    },
    skills: {
        type: Map,
        of: Number,
        default: {}
    },
    currentStreak: {
        type: Number,
        default: 0
    },
    longestStreak: {
        type: Number,
        default: 0
    },
    lastActiveDate: {
        type: Date,
        default: null
    }
}, { timestamps: true })

const progressProfileModel = mongoose.model("progressProfiles", progressProfileSchema)

module.exports = { progressProfileModel, SKILL_KEYS }
