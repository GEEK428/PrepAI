const mongoose = require("mongoose")

const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    hours: {
        type: Number,
        min: 0,
        default: 1
    },
    skill: {
        type: String,
        default: ""
    },
    completed: {
        type: Boolean,
        default: false
    }
}, { _id: false })

const dayPlanSchema = new mongoose.Schema({
    day: {
        type: String,
        enum: [ "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday" ],
        required: true
    },
    tasks: {
        type: [ taskSchema ],
        default: []
    }
}, { _id: false })

const roadmapSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true
    },
    weekStartDate: {
        type: Date,
        required: true
    },
    days: {
        type: [ dayPlanSchema ],
        default: []
    },
    reminderTime: {
        type: String,
        default: "20:00"
    },
    reminderType: {
        type: String,
        enum: [ "in_app", "email", "both" ],
        default: "in_app"
    },
    lastReminderSentAt: {
        type: Date,
        default: null
    }
}, { timestamps: true })

roadmapSchema.index({ user: 1, weekStartDate: 1 }, { unique: true })

const roadmapModel = mongoose.model("roadmaps", roadmapSchema)

module.exports = roadmapModel
