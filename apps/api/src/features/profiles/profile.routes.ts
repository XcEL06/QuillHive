import { Router } from "express";
import { z } from "zod";
import * as ProfileController from "./profile.controller";
import * as Recovery from "./auth-recovery.controller";
import { preventSpam } from "../../middleware/abuseProtection";
import { validateBody } from "../../middleware/validate";
import { rateLimit } from "../../middleware/rateLimit";
import { requireAuth } from "../../middleware/admin";
import { requireCreatorIncomeEnabled } from "../../middleware/creatorIncome";

// Production: 30 login attempts / 15 min, 30 registrations / hr.
// Development/preview: 6× headroom (applied inside rateLimit middleware).
const authStrictLimit = rateLimit({ windowMs: 15 * 60_000, max: 30 });
const registerStrictLimit = rateLimit({ windowMs: 60 * 60_000, max: 30 });

export const registerSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(120),
  inviteCode: z.string().trim().max(32).optional(),
  ref: z.string().trim().max(80).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

const verifyEmailSchema = z.object({
  token: z.string().min(20),
});

const profileSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/).optional(),
  displayName: z.string().min(1).max(120).optional(),
  bio: z.string().max(1000).nullable().optional(),
  headline: z.string().max(200).nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  location: z.string().max(120).nullable().optional(),
  country: z.string().max(100).nullable().optional(),
  facebook: z.string().nullable().optional(),
  linkedin: z.string().nullable().optional(),
  twitter: z.string().nullable().optional(),
  instagram: z.string().nullable().optional(),
  profileVisibility: z.enum(["public", "followers", "private"]).optional(),
  showEmail: z.boolean().optional(),
  showWebsite: z.boolean().optional(),
  showLocation: z.boolean().optional(),
  identityType: z.enum(["everyone","reader","writer","artist","professional","student","builder","community"]).nullable().optional(),
});

const creatorSchema = z.object({
  skills: z.array(z.string().min(1).max(60)).max(20).optional(),
  links: z.array(z.object({ label: z.string().min(1).max(50), url: z.string().min(1).max(500) })).max(10).optional(),
  isAvailableForHire: z.boolean().optional(),
});

export const authRouter = Router();
authRouter.post("/register", registerStrictLimit, preventSpam("register", { max: 5, windowMs: 10 * 60_000, contentField: "email" }), validateBody(registerSchema), ProfileController.register);
authRouter.post("/signup", registerStrictLimit, preventSpam("signup", { max: 5, windowMs: 10 * 60_000, contentField: "email" }), validateBody(registerSchema), ProfileController.register);
authRouter.post("/login", authStrictLimit, validateBody(loginSchema), ProfileController.login);
authRouter.post("/change-password", requireAuth, authStrictLimit, validateBody(z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
})), Recovery.changePassword);
authRouter.post("/logout", ProfileController.logout);
authRouter.post("/refresh", validateBody(refreshSchema), ProfileController.refresh);
authRouter.post("/verify-email", validateBody(verifyEmailSchema), ProfileController.verifyEmail);
authRouter.post("/resend-verification", authStrictLimit, validateBody(z.object({ email: z.string().email().max(254) })), Recovery.resendVerification);
authRouter.post("/forgot-password", authStrictLimit, validateBody(z.object({ email: z.string().email().max(254) })), Recovery.forgotPassword);
authRouter.post("/reset-password", authStrictLimit, validateBody(z.object({ token: z.string().min(20), password: z.string().min(8).max(128) })), Recovery.resetPassword);
authRouter.get("/me/export", Recovery.exportMyData);
authRouter.delete("/me", validateBody(z.object({ confirm: z.string() })), Recovery.deleteMyAccount);
authRouter.get("/me", ProfileController.me);

const workHistorySchema = z.object({
  title: z.string().min(1).max(200),
  organization: z.string().min(1).max(200),
  startYear: z.number().int().min(1900).max(2100),
  endYear: z.number().int().min(1900).max(2100).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
});

const educationSchema = z.object({
  school: z.string().min(1).max(200),
  degree: z.string().min(1).max(200),
  field: z.string().max(200).nullable().optional(),
  startYear: z.number().int().min(1900).max(2100),
  endYear: z.number().int().min(1900).max(2100).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
});

export const usersRouter = Router();
usersRouter.get("/", ProfileController.listUsers);
usersRouter.patch("/me", validateBody(z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/).optional(),
  displayName: z.string().min(1).max(120).optional(),
  onboardingComplete: z.boolean().optional(),
  onboardingGoals: z.array(z.string().max(60)).max(10).optional(),
  interests: z.array(z.string().max(60)).max(20).optional(),
})), ProfileController.completeOnboarding);
usersRouter.patch("/me/profile", validateBody(profileSchema), ProfileController.updateMyProfile);
usersRouter.patch("/me/creator-mode", validateBody(z.object({ isCreatorMode: z.boolean() })), ProfileController.toggleCreatorMode);
usersRouter.patch("/me/settings", validateBody(z.object({
  emailDigestEnabled: z.boolean().optional(),
  topicNotificationEnabled: z.boolean().optional(),
  hireMeEnabled: z.boolean().optional(),
})), ProfileController.updateSettings);
usersRouter.post("/me/verification", validateBody(z.object({ kind: z.enum(["phone", "identity"]) })), ProfileController.requestVerification);
usersRouter.patch("/me/creator", requireCreatorIncomeEnabled, validateBody(creatorSchema), ProfileController.updateMyCreatorProfile);

usersRouter.get("/me/profile-strength", ProfileController.getProfileStrength);
usersRouter.get("/me/profile-viewers", requireAuth, ProfileController.getProfileViewers);
usersRouter.get("/me/work-history", ProfileController.getMyWorkHistory);
usersRouter.post("/me/work-history", validateBody(workHistorySchema), ProfileController.addWorkHistory);
usersRouter.patch("/me/work-history/:id", validateBody(workHistorySchema.partial()), ProfileController.updateWorkHistory);
usersRouter.delete("/me/work-history/:id", ProfileController.deleteWorkHistory);

usersRouter.get("/me/education", ProfileController.getMyEducation);
usersRouter.post("/me/education", validateBody(educationSchema), ProfileController.addEducation);
usersRouter.patch("/me/education/:id", validateBody(educationSchema.partial()), ProfileController.updateEducation);
usersRouter.delete("/me/education/:id", ProfileController.deleteEducation);

usersRouter.get("/search", ProfileController.searchUsers);
usersRouter.get("/suggested", requireAuth, ProfileController.getSuggestedUsers);
usersRouter.get("/recommended", ProfileController.getRecommendedUsers);
usersRouter.get("/hireable", requireCreatorIncomeEnabled, ProfileController.getHireableCreators);
usersRouter.get("/featured", ProfileController.getFeaturedUsers);
usersRouter.get("/me/saved", ProfileController.getMySavedPosts);
usersRouter.get("/:username/portfolio", ProfileController.getUserPortfolio);
usersRouter.get("/:username", ProfileController.getUserByUsername);
usersRouter.get("/:username/creator", requireCreatorIncomeEnabled, ProfileController.getCreatorProfileByUsername);
usersRouter.get("/:username/posts", ProfileController.getUserPosts);
usersRouter.post("/:username/follow", ProfileController.followUser);
usersRouter.get("/:username/followers", ProfileController.getFollowers);
usersRouter.get("/:username/following", ProfileController.getFollowing);
