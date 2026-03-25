const jwt = require("jsonwebtoken")
const tokenBlacklistModel = require("../models/blacklist.model")
const userModel = require("../models/user.model")



async function authUser(req, res, next) {

    // Check Authorization header first (mobile), then cookies (desktop)
    const authHeader = req.headers.authorization
    const token = (authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null) || req.cookies.token

    if (!token) {
        return res.status(401).json({
            message: "Token not provided."
        })
    }

    const isTokenBlacklisted = await tokenBlacklistModel.findOne({
        token
    })

    if (isTokenBlacklisted) {
        return res.status(401).json({
            message: "token is invalid"
        })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const user = await userModel.findById(decoded.id).select("tokenVersion")

        if (!user) {
            return res.status(401).json({
                message: "Invalid token."
            })
        }

        const decodedTokenVersion = typeof decoded.tokenVersion === "number" ? decoded.tokenVersion : 0
        if (decodedTokenVersion !== user.tokenVersion) {
            return res.status(401).json({
                message: "Session expired. Please login again."
            })
        }

        req.user = decoded

        next()

    } catch (err) {

        return res.status(401).json({
            message: "Invalid token."
        })
    }

}


module.exports = { authUser }
