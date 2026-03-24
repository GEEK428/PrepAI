const mongoose = require("mongoose")

const goalModelSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true
    },
    skill: {
        type: String,
        required: true
    },
    currentLevel: {
        type: Number,
        min: 1,
        max: 5,
        required: true
    },
    targetLevel: {
        type: Number,
        min: 1,
        max: 5,
        required: true
    },
    goalType: {
        type: String,
        enum: [ "questions", "study_hours", "score_target" ],
        required: true
    },
    targetValue: {
        type: Number,
        min: 1,
        required: true
    },
    dailyTarget: {
        type: Number,
        min: 1,
        default: 1
    },
    durationDays: {
        type: Number,
        min: 1,
        default: 7
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    currentProgress: {
        type: Number,
        min: 0,
        default: 0
    },
    deadline: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: [ "active", "completed" ],
        default: "active"
    },
    completedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true })

goalModelSchema.index({ user: 1, skill: 1, status: 1 })

const goalModel = mongoose.model("goals", goalModelSchema)

module.exports = goalModel
