const { progressProfileModel } = require("../models/progressProfile.model");

/**
 * @description Records user activity and updates their streak.
 * @param {string} userId - The ID of the active user.
 */
async function recordActivity(userId) {
    try {
        let profile = await progressProfileModel.findOne({ user: userId });
        if (!profile) {
            profile = await progressProfileModel.create({ user: userId });
        }

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        // If they have never been active, start at 1
        if (!profile.lastActiveDate) {
            profile.currentStreak = 1;
            profile.lastActiveDate = today;
        } else {
            const lastActive = new Date(profile.lastActiveDate);
            const lastActiveDateOnly = new Date(lastActive.getFullYear(), lastActive.getMonth(), lastActive.getDate());
            
            const diffTime = today - lastActiveDateOnly;
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                // Consecutive day!
                profile.currentStreak += 1;
                profile.lastActiveDate = today;
            } else if (diffDays > 1) {
                // Streak broken, reset to 1
                profile.currentStreak = 1;
                profile.lastActiveDate = today;
            }
            // Ensure even if initialized at 0, activity today makes it at least 1
            if (profile.currentStreak === 0) {
                profile.currentStreak = 1;
                profile.lastActiveDate = today;
            }
        }

        // Update longest streak if necessary
        if (profile.currentStreak > (profile.longestStreak || 0)) {
            profile.longestStreak = profile.currentStreak;
        }

        await profile.save();
        console.log(`[Progress] Activity recorded for ${userId}. Streak: ${profile.currentStreak}`);
        return profile;
    } catch (err) {
        console.error("[Progress-Error] Failed to record activity:", err.message);
    }
}

module.exports = { recordActivity };
