const mongoose = require("mongoose")

const pendingUserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    verifyToken: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 86400 // auto-delete after 24 hours via MongoDB TTL index
    }
})

const pendingUserModel = mongoose.model("pendingUsers", pendingUserSchema)

module.exports = pendingUserModel
