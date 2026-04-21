require("dotenv").config()
const http = require("http")
const app = require("./src/app")
const connectToDB = require("./src/config/database")
const { startReminderScheduler } = require("./src/services/reminder.scheduler")
const { initSocket } = require("./src/socket")

const PORT = Number(process.env.PORT || 3000)
const server = http.createServer(app)

const REQUIRED_ENVS = ["MONGO_URI", "JWT_SECRET"];

async function bootstrap() {
    /* Global Error Handlers to prevent crashing on free tier */
    process.on('uncaughtException', (err) => {
        console.error('[CRITICAL] Uncaught Exception:', err.message, err.stack);
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
    });

    try {
        const missing = REQUIRED_ENVS.filter(key => !process.env[key]);
        if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
        }

        await connectToDB()
        
        // Initialize Socket.io
        initSocket(server)
        
        startReminderScheduler()

        server.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`)
        })
    } catch (error) {
        console.error("Failed to start server:", error?.message || error)
        process.exit(1)
    }
}

bootstrap()
