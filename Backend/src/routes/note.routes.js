const { Router } = require("express")
const authMiddleware = require("../middlewares/auth.middleware")
const noteController = require("../controllers/note.controller")
const upload = require("../middlewares/file.middleware")

const noteRouter = Router()

noteRouter.post("/", authMiddleware.authUser, noteController.createNoteController)
noteRouter.get("/", authMiddleware.authUser, noteController.getNotesController)
noteRouter.patch("/:noteId", authMiddleware.authUser, noteController.updateNoteController)
noteRouter.delete("/:noteId", authMiddleware.authUser, noteController.deleteNoteController)
noteRouter.post("/export/pdf", authMiddleware.authUser, noteController.exportNotesPdfController)
noteRouter.post("/ai-answer", authMiddleware.authUser, noteController.generateAiAnswerController)
noteRouter.post("/import/pdf", authMiddleware.authUser, upload.single("file"), noteController.importNoteFromPdfController)

module.exports = noteRouter
