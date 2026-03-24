const mongoose = require("mongoose")

const COMMON_SUBDOMAINS = [
    "None",
    "DSA",
    "Core Domain",
    "Developement",
    "Cybersecurity",
    "AI",
    "ML",
    "Data Science",
    "System Design",
    "Cloud/Devops"
]

const NOTE_DOMAIN_MAP = {
    Technical: COMMON_SUBDOMAINS,
    Behavioral: COMMON_SUBDOMAINS,
    "Role Specific": COMMON_SUBDOMAINS
}

const noteSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true
    },
    domain: {
        type: String,
        enum: Object.keys(NOTE_DOMAIN_MAP),
        required: true
    },
    subdomain: {
        type: String,
        required: true
    },
    question: {
        type: String,
        required: true
    },
    answer: {
        type: String,
        default: ""
    },
    answerHtml: {
        type: String,
        default: ""
    },
    tags: {
        type: [ String ],
        default: []
    },
    difficulty: {
        type: String,
        enum: [ "easy", "medium", "hard" ],
        default: "medium"
    },
    status: {
        type: String,
        enum: [ "pending", "done", "needs_revision" ],
        default: "pending"
    },
    bookmarked: {
        type: Boolean,
        default: false
    },
    sourceTag: {
        type: String,
        default: ""
    },
    confidence: {
        type: Number,
        min: 1,
        max: 5,
        default: 3
    },
    spacedRepetitionDueAt: {
        type: Date,
        default: null
    }
}, { timestamps: true })

const noteModel = mongoose.model("Note", noteSchema)

module.exports = { noteModel, NOTE_DOMAIN_MAP }
