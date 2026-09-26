import { Router } from "express";
import * as GalleryController from "./gallery.controller";

export const galleryRouter = Router();
galleryRouter.get("/:userId", GalleryController.getPortfolioItems);
galleryRouter.post("/", GalleryController.addPortfolioItem);
galleryRouter.patch("/:id", GalleryController.updatePortfolioItem);
galleryRouter.delete("/:id", GalleryController.deletePortfolioItem);
