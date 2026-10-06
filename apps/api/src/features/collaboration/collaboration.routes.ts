import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import * as CollaborationController from "./collaboration.controller";
import { db } from "@workspace/db";
import { collaborationRoomsTable } from "@workspace/db/schema";

export const collaborationRouter = Router();
collaborationRouter.param("roomId", async (req: Request, res: Response, next: NextFunction, id: string) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return next();
  try {
    const [room] = await db.select({ id: collaborationRoomsTable.id }).from(collaborationRoomsTable).where(eq(collaborationRoomsTable.publicId, id));
    if (!room) return res.status(404).json({ error: "Workspace not found" });
    req.params.roomId = String(room.id);
    return next();
  } catch (error) {
    return next(error);
  }
});
collaborationRouter.post("/request", CollaborationController.sendRequest);
collaborationRouter.get("/requests/received", CollaborationController.getReceivedRequests);
collaborationRouter.get("/requests/sent", CollaborationController.getSentRequests);
collaborationRouter.patch("/requests/:requestId", CollaborationController.updateRequest);
collaborationRouter.get("/rooms", CollaborationController.getRooms);
collaborationRouter.post("/rooms", CollaborationController.createRoom);
collaborationRouter.patch("/rooms/:roomId", CollaborationController.updateRoom);
