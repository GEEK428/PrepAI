const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require("cors")

const app = express()

app.use(express.json())
app.use(cookieParser())
const allowedOrigins = [ "http://localhost:5173", "http://localhost:5174" ]
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true)
        }
        return callback(new Error("Not allowed by CORS"))
    },
    credentials: true
}))

/* require all the routes here */
const authRouter = require("./routes/auth.routes")
const interviewRouter = require("./routes/interview.routes")
const noteRouter = require("./routes/note.routes")
const progressRouter = require("./routes/progress.routes")


/* using all the routes here */
app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)
app.use("/api/notes", noteRouter)
app.use("/api/progress", progressRouter)

app.use((err, req, res, next) => {
    if (!err) {
        return next()
    }

    const rawMessage = String(err?.message || "")
    const normalizedMessage = rawMessage.toLowerCase()
    const statusCode = Number(err?.status || err?.statusCode || 0)
    const isAiLimitError = statusCode === 429
        || normalizedMessage.includes("resource_exhausted")
        || normalizedMessage.includes("quota")
        || normalizedMessage.includes("rate limit")
        || normalizedMessage.includes("too many requests")
        || normalizedMessage.includes("429")

    if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
            message: "File size exceeds 10MB limit."
        })
    }

    if (isAiLimitError) {
        return res.status(429).json({
            message: "You have reached limit. Please answer yourself."
        })
    }

    if (err.message) {
        return res.status(400).json({
            message: err.message
        })
    }

    return res.status(500).json({
        message: "Internal server error."
    })
})



module.exports = app
