const { Router } = require("express")
const authMiddleware = require("../middlewares/auth.middleware")
const progressController = require("../controllers/progress.controller")

const progressRouter = Router()

progressRouter.get("/overview", authMiddleware.authUser, progressController.getOverviewController)
progressRouter.get("/stats", authMiddleware.authUser, progressController.getStatsController)
progressRouter.get("/notifications", authMiddleware.authUser, progressController.getNotificationsController)
progressRouter.patch("/notifications/:notificationId/read", authMiddleware.authUser, progressController.markNotificationReadController)
progressRouter.patch("/notifications/read-all", authMiddleware.authUser, progressController.markAllNotificationsReadController)

progressRouter.post("/assessment", authMiddleware.authUser, progressController.saveAssessmentController)

progressRouter.post("/goals", authMiddleware.authUser, progressController.createGoalController)
progressRouter.get("/goals", authMiddleware.authUser, progressController.getGoalsController)
progressRouter.patch("/goals/:goalId", authMiddleware.authUser, progressController.updateGoalController)
progressRouter.delete("/goals/:goalId", authMiddleware.authUser, progressController.deleteGoalController)

progressRouter.post("/roadmap", authMiddleware.authUser, progressController.saveRoadmapController)
progressRouter.put("/roadmap/:day", authMiddleware.authUser, progressController.updateRoadmapDayController)
progressRouter.patch("/reminders", authMiddleware.authUser, progressController.updateReminderSettingsController)

progressRouter.post("/checkin", authMiddleware.authUser, progressController.createCheckinController)

module.exports = progressRouter
