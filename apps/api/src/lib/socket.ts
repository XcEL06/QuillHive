import { Server as HttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import { logger } from "./logger";
import { getSessionAuthVersion, getSessionUserId, isTokenBlacklisted } from "./auth";
import { db } from "@workspace/db";
import { conversationsTable, conversationParticipantsTable, postsTable, supportTicketsTable, usersTable, groupMembersTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";

let io: SocketServer | null = null;

async function isConversationParticipant(conversationId: number, userId: number): Promise<boolean> {
  const [participant] = await db
    .select({ id: conversationParticipantsTable.id })
    .from(conversationParticipantsTable)
    .where(and(eq(conversationParticipantsTable.conversationId, conversationId), eq(conversationParticipantsTable.userId, userId)))
    .limit(1);
  return Boolean(participant);
}

async function canJoinSupportTicket(ticketId: number, userId: number): Promise<boolean> {
  const [ticket] = await db
    .select({ ownerId: supportTicketsTable.userId })
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.id, ticketId))
    .limit(1);
  if (ticket?.ownerId === userId) return true;
  const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return user?.role === "admin" || user?.role === "super_admin";
}

async function canJoinPost(postId: number): Promise<boolean> {
  const [post] = await db
    .select({ id: postsTable.id })
    .from(postsTable)
    .where(and(eq(postsTable.id, postId), eq(postsTable.isDeleted, false)))
    .limit(1);
  return Boolean(post);
}

async function publishGroupPresence(groupId: number): Promise<void> {
  if (!io) return;
  const room = `group:${groupId}`;
  const sockets = await io.in(room).fetchSockets();
  const onlineCount = new Set(sockets.map((socket) => socket.data.userId).filter(Number.isInteger)).size;
  io.to(room).emit("group:presence", { groupId, onlineCount });
}

export function setupSocket(httpServer: HttpServer): SocketServer {
  const appUrl = process.env.APP_URL ?? "";
  
  io = new SocketServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) { callback(null, true); return; }
        const allowed =
          (appUrl && origin === appUrl) ||
          /^https:\/\/[^/]*\.quillhive\.pages\.dev$/.test(origin ?? "") ||
          (process.env.NODE_ENV !== "production" && (
            /^https?:\/\/[^/]*\.replit\.dev$/.test(origin ?? "") ||
            /^https?:\/\/[^/]*\.repl\.co$/.test(origin ?? "") ||
            /^https?:\/\/localhost(:\d+)?$/.test(origin ?? "")
          ));
        if (allowed) callback(null, true);
        else callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "POST"],
    },
    path: "/api/socket.io",
  });

  io.use(async (socket, next) => {
    const authToken = socket.handshake.auth?.token;
    const header = socket.handshake.headers.authorization;
    const token = typeof authToken === "string"
      ? authToken
      : header?.startsWith("Bearer ")
        ? header.slice(7)
        : null;
    const userId = token ? getSessionUserId(token) : null;
    if (!userId || (await isTokenBlacklisted(token!))) {
      next(new Error("Unauthorized"));
      return;
    }
    const [user] = await db.select({ authVersion: usersTable.authVersion }).from(usersTable).where(eq(usersTable.id, userId));
    if (!user || getSessionAuthVersion(token!) !== user.authVersion) {
      next(new Error("Unauthorized"));
      return;
    }
    socket.data.userId = userId;
    socket.data.authToken = token;
    next();
  });

  io.on("connection", (socket) => {
    socket.data.groupIds = [] as number[];
    logger.info({ socketId: socket.id }, "Client connected");

    socket.use(async (_event, next) => {
      const token = socket.data.authToken as string;
      const userId = getSessionUserId(token);
      try {
        if (!userId || await isTokenBlacklisted(token)) throw new Error("Unauthorized");
        const [user] = await db.select({ authVersion: usersTable.authVersion }).from(usersTable).where(eq(usersTable.id, userId));
        if (!user || getSessionAuthVersion(token) !== user.authVersion) throw new Error("Unauthorized");
        next();
      } catch {
        socket.disconnect(true);
        next(new Error("Unauthorized"));
      }
    });

    socket.on("join:user", (userId: number) => {
      if (userId !== socket.data.userId) return;
      socket.join(`user:${userId}`);
      logger.info({ socketId: socket.id, userId }, "User joined their room");
    });

    socket.on("join:conversation", async (conversationId: number) => {
      if (!Number.isInteger(conversationId) || !(await isConversationParticipant(conversationId, socket.data.userId))) return;
      socket.join(`conversation:${conversationId}`);
    });

    socket.on("join:group", async (groupId: number) => {
      if (!Number.isInteger(groupId) || groupId <= 0) return;
      const [membership] = await db.select({ status: groupMembersTable.status })
        .from(groupMembersTable)
        .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, socket.data.userId)));
      if (!membership || !["active", "muted"].includes(membership.status)) return;
      const room = `group:${groupId}`;
      socket.join(room);
      const groupIds = socket.data.groupIds as number[];
      if (!groupIds.includes(groupId)) groupIds.push(groupId);
      await publishGroupPresence(groupId);
    });

    socket.on("leave:group", async (groupId: number) => {
      if (!Number.isInteger(groupId) || groupId <= 0) return;
      socket.leave(`group:${groupId}`);
      socket.data.groupIds = (socket.data.groupIds as number[]).filter((joinedGroupId) => joinedGroupId !== groupId);
      await publishGroupPresence(groupId);
    });

    socket.on("message:send", async (data: { conversationId: number; message: any }) => {
      if (!Number.isInteger(data?.conversationId) || !(await isConversationParticipant(data.conversationId, socket.data.userId))) return;
      io?.to(`conversation:${data.conversationId}`).emit("message:receive", data.message);
    });

    socket.on("typing:start", async (data: { conversationId: number; userId: number }) => {
      if (!Number.isInteger(data?.conversationId) || !(await isConversationParticipant(data.conversationId, socket.data.userId))) return;
      socket.to(`conversation:${data.conversationId}`).emit("typing:start", data);
    });

    socket.on("typing:stop", async (data: { conversationId: number; userId: number }) => {
      if (!Number.isInteger(data?.conversationId) || !(await isConversationParticipant(data.conversationId, socket.data.userId))) return;
      socket.to(`conversation:${data.conversationId}`).emit("typing:stop", data);
    });

    socket.on("join:support", async (ticketId: number) => {
      if (!Number.isInteger(ticketId) || !(await canJoinSupportTicket(ticketId, socket.data.userId))) return;
      socket.join(`support:${ticketId}`);
    });

    socket.on("join:post", async (postId: number) => {
      if (!Number.isInteger(postId) || !(await canJoinPost(postId))) return;
      socket.join(`post:${postId}`);
      // Count simultaneous readers in this post room
      try {
        const room = io?.sockets.adapter.rooms.get(`post:${postId}`);
        const liveCount = room ? room.size : 0;
        io?.to(`post:${postId}`).emit("view_update", { postId, liveCount });

        if (liveCount >= 3) {
          const { getRedis } = await import("./redis");
          const redis = getRedis();
          const notifKey = `live-notif:${postId}`;
          const alreadySent = redis ? await redis.get(notifKey) : null;
          if (!alreadySent) {
            const { db } = await import("@workspace/db");
            const { postsTable } = await import("@workspace/db/schema");
            const { eq } = await import("drizzle-orm");
            const [post] = await db
              .select({ authorId: postsTable.authorId, title: postsTable.title })
              .from(postsTable)
              .where(eq(postsTable.id, postId));
            if (post?.authorId) {
              const { notify } = await import("../features/notifications/notification.service");
              await notify({
                userId: post.authorId,
                type: "system",
                title: `🔥 ${liveCount} people reading your post right now`,
                message: `"${(post.title ?? "Your post").slice(0, 50)}" has ${liveCount} simultaneous readers.`,
                url: `/post/${postId}`,
                postId,
              });
              if (redis) await redis.set(notifKey, "1", { ex: 3600 });
            }
          }
        }
      } catch (error) {
        logger.warn({ error, postId }, "Failed to update live view count");
      }
    });

    socket.on("disconnect", () => {
      const groupIds = socket.data.groupIds as number[];
      for (const groupId of groupIds) void publishGroupPresence(groupId);
    });

    socket.on("leave:post", (postId: number) => {
      socket.leave(`post:${postId}`);
    });

    socket.on("join:admin", () => {
      void db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, socket.data.userId)).limit(1)
        .then(([user]) => {
          if (user?.role === "admin" || user?.role === "super_admin") socket.join("admin:monitoring");
        })
        .catch((error) => logger.warn({ error, userId: socket.data.userId }, "Failed to authorize admin socket room"));
    });
    socket.on("leave:admin", () => {
      socket.leave("admin:monitoring");
    });

    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Client disconnected");
    });
  });

  return io;
}

export function disconnectUserSockets(userId: number): void {
  for (const socket of io?.sockets.sockets.values() ?? []) {
    if (socket.data.userId === userId) socket.disconnect(true);
  }
}

export function emitToUser(userId: number, event: string, data: any) {
  io?.to(`user:${userId}`).emit(event, data);
}

export function emitToConversation(conversationId: number, event: string, data: any) {
  io?.to(`conversation:${conversationId}`).emit(event, data);
}

export function emitToSupportTicket(ticketId: number, event: string, data: any) {
  io?.to(`support:${ticketId}`).emit(event, data);
}

export function emitToPost(postId: number, event: string, data: unknown): void {
  io?.to(`post:${postId}`).emit(event, data);
}

export function emitToAdmins(event: string, data: unknown): void {
  io?.to("admin:monitoring").emit(event, data);
}

export function getIO(): SocketServer | null {
  return io;
}
