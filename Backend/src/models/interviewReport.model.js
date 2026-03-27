const mongoose = require('mongoose');

const technicalQuestionSchema = new mongoose.Schema({
    question: { type: String, required: [true, "Technical question is required"] },
    intention: { type: String, required: [true, "Intention is required"] },
    answer:    { type: String, required: [true, "Answer is required"] }
}, { _id: false })

const behavioralQuestionSchema = new mongoose.Schema({
    question: { type: String, required: [true, "Technical question is required"] },
    intention: { type: String, required: [true, "Intention is required"] },
    answer:    { type: String, required: [true, "Answer is required"] }
}, { _id: false })

const skillGapSchema = new mongoose.Schema({
    skill:    { type: String, required: [true, "Skill is required"] },
    severity: { type: String, enum: ["low", "medium", "high"], required: [true, "Severity is required"] }
}, { _id: false })

const preparationPlanSchema = new mongoose.Schema({
    day:   { type: Number, required: [true, "Day is required"] },
    focus: { type: String, required: [true, "Focus is required"] },
    tasks: [{ type: String, required: [true, "Task is required"] }]
})

const interviewReportSchema = new mongoose.Schema({
    jobDescription:  { type: String, required: [true, "Job description is required"] },
    resume:          { type: String },
    selfDescription: { type: String },
    matchScore:      { type: Number, min: 0, max: 100 },
    technicalQuestions:  [technicalQuestionSchema],
    behavioralQuestions: [behavioralQuestionSchema],
    skillGaps:           [skillGapSchema],
    topSkills:           [{ type: String }],
    preparationPlan:     [preparationPlanSchema],
    user:  { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    title: { type: String, required: [true, "Job title is required"] },

    /* ── Resume PDF Cache ─────────────────────────────────────────
       resumePdfCache : The last generated PDF as a Buffer.
       resumeInputHash: SHA-256 of (resume + jobDescription + topSkills)
                        so we detect genuine input changes.
       When the hash hasn't changed we return the cached PDF immediately
       without calling AI or Puppeteer again.
    ───────────────────────────────────────────────────────────── */
    resumePdfCache:  { type: Buffer, default: null },
    resumeInputHash: { type: String,  default: null }

}, { timestamps: true })

const interviewReportModel = mongoose.model("InterviewReport", interviewReportSchema);

module.exports = interviewReportModel;
