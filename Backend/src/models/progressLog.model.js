const mongoose = require("mongoose")

const progressLogSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    hoursStudied: {
        type: Number,
        min: 0,
        default: 0
    },
    notesCompleted: {
        type: Number,
        min: 0,
        default: 0
    },
    mockScore: {
        type: Number,
        min: 0,
        max: 100,
        default: null
    },
    skillScores: {
        type: Map,
        of: Number,
        default: {}
    },
    completedRoadmapTasks: {
        type: Number,
        min: 0,
        default: 0
    }
}, { timestamps: true })

progressLogSchema.index({ user: 1, date: 1 }, { unique: true })

const progressLogModel = mongoose.model("progressLogs", progressLogSchema)

module.exports = progressLogModel
