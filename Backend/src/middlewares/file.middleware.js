const multer = require("multer")

const allowedMimeTypes = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
])

const allowedExtensions = new Set([ ".pdf", ".doc", ".docx" ])

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: (req, file, cb) => {
        const extension = `.${(file.originalname || "").split(".").pop()?.toLowerCase() || ""}`
        const isAllowedMime = allowedMimeTypes.has(file.mimetype)
        const isAllowedExtension = allowedExtensions.has(extension)

        if (isAllowedMime || isAllowedExtension) {
            return cb(null, true)
        }

        return cb(new Error("Only PDF, DOC and DOCX files are allowed."))
    }
})


module.exports = upload
