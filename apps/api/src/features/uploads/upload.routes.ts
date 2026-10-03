import { mkdir, readFile, writeFile, access } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import sharp from "sharp";
import { v2 as cloudinary } from "cloudinary";
import { db } from "@workspace/db";
import { uploadedFilesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../../middleware/admin";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate";
import { logger } from "../../lib/logger";

// ─── Cloudinary (optional, used when env vars are present) ────────────────────
function isCloudinaryConfigured(): boolean {
  return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

async function uploadToCloudinary(
  buffer: Buffer,
  mimeType: string,
  category: string,
): Promise<{ url: string; publicId: string; variants?: Record<number, string> }> {
  const resourceType: "image" | "video" | "raw" = mimeType.startsWith("video/") || mimeType.startsWith("audio/")
    ? "video"
    : mimeType.startsWith("image/")
      ? "image"
      : "raw";

  const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: resourceType, folder: `quillhive/${category}`, use_filename: false, unique_filename: true, quality: "auto", fetch_format: "auto" },
      (err, res) => {
        if (err) return reject(err);
        if (!res) return reject(new Error("no cloudinary result"));
        resolve(res as { secure_url: string; public_id: string });
      },
    );
    stream.end(buffer);
  });

  const isImgVariant = mimeType.startsWith("image/") && mimeType !== "image/gif";
  const variants: Record<number, string> | undefined = isImgVariant
    ? {
        400: cloudinary.url(result.public_id, { width: 400, crop: "scale", quality: "auto", fetch_format: "auto", secure: true }),
        800: cloudinary.url(result.public_id, { width: 800, crop: "scale", quality: "auto", fetch_format: "auto", secure: true }),
        1600: cloudinary.url(result.public_id, { width: 1600, crop: "scale", quality: "auto", fetch_format: "auto", secure: true }),
      }
    : undefined;

  return { url: result.secure_url, publicId: result.public_id, variants };
}

// ─── Local fallback helpers ───────────────────────────────────────────────────
const IMAGE_VARIANT_WIDTHS = [400, 800, 1600] as const;
type VariantWidth = (typeof IMAGE_VARIANT_WIDTHS)[number];

function variantPath(originalPath: string, width: VariantWidth): string {
  const ext = path.extname(originalPath);
  const base = originalPath.slice(0, originalPath.length - ext.length);
  return `${base}-w${width}.webp`;
}

async function generateImageVariants(originalPath: string, mimeType: string): Promise<void> {
  if (!mimeType.startsWith("image/") || mimeType === "image/gif") return;
  try {
    const meta = await sharp(originalPath, { failOn: "none" }).metadata();
    const srcWidth = meta.width ?? 0;
    await Promise.all(
      IMAGE_VARIANT_WIDTHS.map(async (w) => {
        const targetWidth = srcWidth > 0 && srcWidth < w ? srcWidth : w;
        await sharp(originalPath, { failOn: "none" })
          .rotate()
          .resize({ width: targetWidth, withoutEnlargement: true })
          .webp({ quality: 82 })
          .toFile(variantPath(originalPath, w));
      }),
    );
  } catch (err) {
    logger.warn({ err, originalPath }, "image_variant_generation_failed");
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const allowedDocumentMimeTypes = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf", "text/plain", "text/csv", "text/markdown",
  "application/json", "application/xml", "text/xml",
  "application/rtf", "text/rtf", "application/epub+zip", "application/zip",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text", "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
]);

function isAllowedUploadMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/") || mimeType.startsWith("video/") || mimeType.startsWith("audio/") || allowedDocumentMimeTypes.has(mimeType);
}

const uploadSchema = z.object({
  filename: z.string().min(1).max(180),
  mimeType: z.string().min(3).max(180),
  dataBase64: z.string().min(1),
  category: z.enum(["general", "post", "support", "profile", "moderation", "gallery", "library", "group"]).optional(),
});

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
});

const allowedCategories = ["general", "post", "support", "profile", "moderation", "gallery", "library", "group"] as const;

function normalizeCategory(value: unknown): typeof allowedCategories[number] {
  return allowedCategories.includes(String(value) as typeof allowedCategories[number])
    ? (String(value) as typeof allowedCategories[number])
    : "general";
}

async function processUpload({
  fileName,
  mimeType,
  buffer,
  category,
  userId,
  res,
}: {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  category: typeof allowedCategories[number];
  userId: number;
  res: any;
}) {
  if (!isAllowedUploadMimeType(mimeType)) return res.status(400).json({ error: "File type is not allowed." });
  if (buffer.byteLength > MAX_FILE_SIZE) return res.status(413).json({ error: "File exceeds the 50MB limit." });

  const moderationStatus = mimeType.startsWith("image/") || mimeType.startsWith("text/") || mimeType === "application/pdf"
    ? "approved"
    : "pending_review";

  if (isCloudinaryConfigured() && (mimeType.startsWith("image/") || mimeType.startsWith("video/"))) {
    try {
      const { url, variants } = await uploadToCloudinary(buffer, mimeType, category);
      const [file] = await db.insert(uploadedFilesTable).values({
        ownerId: userId,
        originalName: fileName,
        storagePath: url,
        mimeType,
        sizeBytes: buffer.byteLength,
        category,
        moderationStatus,
      }).returning();
      return res.status(201).json({ ...file, url, variants, provider: "cloudinary" });
    } catch (err) {
      logger.warn({ err }, "cloudinary_upload_failed_falling_back_to_local");
    }
  }

  if (isEphemeralProduction() && !process.env.UPLOADS_DIR?.trim()) {
    return res.status(503).json({
      error: "Durable file storage is not configured. Configure Cloudinary or set UPLOADS_DIR to a persistent volume before uploading.",
    });
  }

  await mkdir(uploadsDir(), { recursive: true });
  const storedName = `${Date.now()}-${randomBytes(8).toString("hex")}${safeExtension(fileName)}`;
  const storagePath = path.join(uploadsDir(), storedName);
  await writeFile(storagePath, buffer);
  await generateImageVariants(storagePath, mimeType);

  const [file] = await db.insert(uploadedFilesTable).values({
    ownerId: userId,
    originalName: fileName,
    storagePath,
    mimeType,
    sizeBytes: buffer.byteLength,
    category,
    moderationStatus,
  }).returning();

  const isImage = mimeType.startsWith("image/") && mimeType !== "image/gif";
  const variants = isImage
    ? Object.fromEntries(IMAGE_VARIANT_WIDTHS.map((w) => [w, `/api/file/${file.id}?w=${w}`]))
    : undefined;

  return res.status(201).json({ ...file, url: `/api/file/${file.id}`, variants, provider: "local" });
}

function uploadsDir() {
  return path.resolve(process.env.UPLOADS_DIR?.trim() || path.join(process.cwd(), "uploads"));
}

function isEphemeralProduction() {
  return process.env.NODE_ENV === "production" || Boolean(process.env.RENDER) || Boolean(process.env.RAILWAY_ENVIRONMENT_NAME);
}

function safeExtension(filename: string) {
  return path.extname(filename).toLowerCase().replace(/[^a-z0-9.]/g, "") || ".bin";
}

export const uploadRouter = Router();

uploadRouter.post("/", requireAuth, async (req: any, res, next) => {
  const contentType = String(req.headers["content-type"] ?? "");

  if (contentType.includes("multipart/form-data")) {
    return uploadMemory.single("file")(req, res, async (multerError: any) => {
      if (multerError) {
        return res.status(400).json({ error: multerError.message || "Upload failed." });
      }

      const file = req.file as Express.Multer.File | undefined;
      if (!file) return res.status(400).json({ error: "No file uploaded." });

      return processUpload({
        fileName: file.originalname || "upload.bin",
        mimeType: file.mimetype || "application/octet-stream",
        buffer: file.buffer,
        category: normalizeCategory(req.body?.category),
        userId: req.currentUser.id,
        res,
      });
    });
  }

  return validateBody(uploadSchema)(req, res, async () => {
    const { filename, mimeType, dataBase64, category = "general" } = req.body;
    const buffer = Buffer.from(dataBase64, "base64");
    return processUpload({
      fileName: filename,
      mimeType,
      buffer,
      category: normalizeCategory(category),
      userId: req.currentUser.id,
      res,
    });
  });
});

uploadRouter.get(
  "/:id",
  validateParams(z.object({ id: z.coerce.number().int().positive() })),
  validateQuery(z.object({ w: z.coerce.number().int().optional() })),
  async (req, res) => {
    const [file] = await db.select().from(uploadedFilesTable).where(eq(uploadedFilesTable.id, Number(req.params.id)));
    if (!file) return res.status(404).json({ error: "File not found" });

    // Cloudinary-hosted: redirect
    if (file.storagePath.startsWith("https://")) {
      return res.redirect(302, file.storagePath);
    }

    const requestedWidth = req.query.w ? Number(req.query.w) : null;
    const useVariant =
      requestedWidth !== null &&
      (IMAGE_VARIANT_WIDTHS as readonly number[]).includes(requestedWidth) &&
      file.mimeType.startsWith("image/") &&
      file.mimeType !== "image/gif";

    if (useVariant) {
      const vp = variantPath(file.storagePath, requestedWidth as VariantWidth);
      try {
        await access(vp);
        const data = await readFile(vp);
        res.setHeader("Content-Type", "image/webp");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return res.send(data);
      } catch { /* fall through */ }
    }

    try {
      const data = await readFile(file.storagePath);
      res.setHeader("Content-Type", file.mimeType);
      res.setHeader("Content-Disposition", `inline; filename="${file.originalName.replace(/"/g, "")}"`);
      return res.send(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        logger.warn({ fileId: file.id }, "uploaded_file_bytes_missing");
        return res.status(410).json({ error: "This file is no longer available. Please upload it again." });
      }
      throw error;
    }
  },
);
