export function shouldPresentAchievementSheet(achievement: { type: string; celebration: "major" | "minor" }): boolean {
  if (achievement.celebration !== "major") return false;
  if (achievement.type.startsWith("TARGET_")) return achievement.type === "TARGET_100";
  return true;
}
