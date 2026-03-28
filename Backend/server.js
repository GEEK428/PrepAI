require("dotenv").config()
const app = require("./src/app")
const connectToDB = require("./src/config/database")
const { startReminderScheduler } = require("./src/services/reminder.scheduler")

const PORT = Number(process.env.PORT || 3000)

async function bootstrap() {
    try {
        await connectToDB()
        startReminderScheduler()

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`)
        })
    } catch (error) {
        console.error("Failed to start server:", error?.message || error)
        process.exit(1)
    }
}

bootstrap()
