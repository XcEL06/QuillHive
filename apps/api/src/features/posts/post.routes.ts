import { Router } from "express";
import { z } from "zod";
import * as PostController from "./post.controller";
import { preventSpam } from "../../middleware/abuseProtection";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate";
import { optionalAuth, requireAuth } from "../../middleware/admin";

const idParamsSchema = z.object({ id: z.coerce.number().int().positive() });
const listPostsQuerySchema = z.object({
  type: z.string().min(1).max(50).optional(),
  feed: z.string().max(40).optional(),
  page: z.coerce.number().int().positive().max(10_000).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  mine: z.enum(["true", "false"]).optional(),
});
const feedQuerySchema = z.object({
  type: z.enum(["algorithmic", "chronological"]).optional(),
  page: z.coerce.number().int().positive().max(10_000).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  since: z.string().datetime().optional(),
});
const trendingQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).optional(),
});
const VALID_POST_TYPES = ["post", "article", "story", "poem", "novel", "artwork", "spark"] as const;
export const postBodySchema = z.object({
  title: z.string().max(180).nullable().optional(),
  titleA: z.string().max(180).nullable().optional(),
  titleB: z.string().max(180).nullable().optional(),
  content: z.string().min(1).max(50_000),
  excerpt: z.string().max(500).nullable().optional(),
  type: z.enum(VALID_POST_TYPES),
  visibility: z.enum(["public", "followers", "private"]).optional(),
  imageUrl: z.string().url().nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(12).optional(),
  isPublished: z.boolean().optional(),
  groupId: z.number().int().positive().nullable().optional(),
  seriesId: z.number().int().positive().optional(),
  quotedPostId: z.number().int().positive().optional(),
  scheduledAt: z.string().optional(),
  attachments: z.array(z.any()).max(20).optional(),
});
const updatePostBodySchema = postBodySchema.omit({ groupId: true }).partial().refine(value => Object.keys(value).length > 0, { message: "At least one field is required" });
const commentBodySchema = z.object({ content: z.string().min(1).max(2_000) });

const commentIdParamsSchema = z.object({ id: z.coerce.number().int().positive() });
const replyBodySchema = z.object({ content: z.string().min(1).max(2_000) });

const draftBodySchema = z.object({
  draftId: z.coerce.number().int().positive().optional(),
  title: z.string().max(180).optional(),
  content: z.string().min(1).max(50_000),
  type: z.string().max(50).optional(),
  visibility: z.enum(["public", "followers", "private"]).optional(),
  tags: z.array(z.string().min(1).max(40)).max(12).optional(),
  imageUrl: z.string().url().optional(),
  attachments: z.array(z.any()).max(20).optional(),
});

export const postsRouter = Router();
postsRouter.get("/my-drafts", PostController.listMyDrafts);
postsRouter.post("/draft", validateBody(draftBodySchema), PostController.saveDraft);
postsRouter.get("/draft/:id", validateParams(idParamsSchema), PostController.getDraft);
postsRouter.delete("/draft/:id", validateParams(idParamsSchema), PostController.deleteDraft);
postsRouter.get("/", optionalAuth, validateQuery(listPostsQuerySchema), PostController.listPosts);
postsRouter.post("/", preventSpam("posts", { max: 6, windowMs: 60_000 }), validateBody(postBodySchema), PostController.createPost);
postsRouter.get("/:id", validateParams(idParamsSchema), PostController.getPost);
postsRouter.patch("/:id", validateParams(idParamsSchema), validateBody(updatePostBodySchema), PostController.updatePost);
postsRouter.delete("/:id", validateParams(idParamsSchema), PostController.deletePost);
postsRouter.get("/:id/comments", validateParams(idParamsSchema), PostController.getTopLevelComments);
postsRouter.post("/:id/comments", validateParams(idParamsSchema), preventSpam("comments", { max: 12, windowMs: 60_000 }), validateBody(commentBodySchema), PostController.createComment);
postsRouter.post("/:id/like", validateParams(idParamsSchema), PostController.likePost);
postsRouter.get("/:id/curators", validateParams(idParamsSchema), PostController.getCurators);
postsRouter.post("/:id/share", validateParams(idParamsSchema), PostController.sharePost);
postsRouter.post("/:id/track-share", validateParams(idParamsSchema), PostController.trackShareClick);
postsRouter.post("/:id/repost", validateParams(idParamsSchema), PostController.repostPost);
postsRouter.get("/:id/reposts", validateParams(idParamsSchema), PostController.getReposts);
postsRouter.post("/:id/save", validateParams(idParamsSchema), PostController.savePost);
postsRouter.delete("/:id/save", validateParams(idParamsSchema), PostController.unsavePost);

export const sparksRouter = Router();
sparksRouter.get("/active", requireAuth, PostController.listRecentSparks);
sparksRouter.post("/:id/view", requireAuth, validateParams(idParamsSchema), PostController.viewSpark);

const abClickParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  variant: z.enum(["a", "b"]),
});
postsRouter.post("/:id/ab-click/:variant", validateParams(abClickParamsSchema), PostController.trackAbClick);

export const commentsRouter = Router();
commentsRouter.get("/:id/replies", validateParams(commentIdParamsSchema), PostController.getCommentReplies);
commentsRouter.post("/:id/reply", validateParams(commentIdParamsSchema), validateBody(replyBodySchema), PostController.replyToComment);
commentsRouter.post("/:id/like", validateParams(commentIdParamsSchema), PostController.likeComment);
commentsRouter.delete("/:id/like", validateParams(commentIdParamsSchema), PostController.likeComment);

const motionQuerySchema = z.object({
  page: z.coerce.number().int().positive().max(10_000).optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
  feed: z.enum(["following", "trending"]).optional(),
});

export const feedRouter = Router();
feedRouter.get("/feed", validateQuery(feedQuerySchema), PostController.getFeed);
feedRouter.get("/feed/trending", validateQuery(trendingQuerySchema), PostController.getTrending);
feedRouter.get("/feed/motion", validateQuery(motionQuerySchema), PostController.getMotion);
