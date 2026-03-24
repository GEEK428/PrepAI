const mongoose = require("mongoose")

const notificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true
    },
    type: {
        type: String,
        enum: [ "reminder", "catch_up", "system" ],
        default: "system"
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    readAt: {
        type: Date,
        default: null
    },
    meta: {
        type: Object,
        default: {}
    }
}, { timestamps: true })

notificationSchema.index({ user: 1, createdAt: -1 })

const notificationModel = mongoose.model("notifications", notificationSchema)

module.exports = notificationModel
