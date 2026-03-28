const mongoose = require("mongoose")

async function connectToDB() {
    const startedAt = Date.now()
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 15000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 1
        })

        const tookMs = Date.now() - startedAt
        console.log(`Connected to Database in ${tookMs}ms`)
    }
    catch (err) {
        console.log("Database connection failed:", err?.message || err)
        throw err
    }
}

module.exports = connectToDB
