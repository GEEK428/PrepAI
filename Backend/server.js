require("dotenv").config()
const app = require("./src/app")
const connectToDB = require("./src/config/database")
const { startReminderScheduler } = require("./src/services/reminder.scheduler")

connectToDB()
startReminderScheduler()


app.listen(3000, () => {
    console.log("Server is running on port 3000")
})
