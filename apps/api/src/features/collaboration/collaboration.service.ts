import { db } from "@workspace/db";
import { collaborationRequestsTable, collaborationRoomsTable, opportunityApplicationsTable, jobsTable } from "@workspace/db/schema";
import { eq, and, or, desc, inArray } from "drizzle-orm";
import { getUserWithCounts } from "../profiles/profile.service";
import { startConversation, sendMessage } from "../messaging/messaging.service";
import { canAccessOpportunityWorkspace } from "../creator-economy/opportunityWorkflow";

export async function sendCollaborationRequest(
  senderId: number,
  receiverId: number,
  message: string
) {
  const existing = await db
    .select()
    .from(collaborationRequestsTable)
    .where(
      and(
        eq(collaborationRequestsTable.senderId, senderId),
        eq(collaborationRequestsTable.receiverId, receiverId),
        eq(collaborationRequestsTable.status, "pending")
      )
    );

  if (existing.length > 0) {
    return { request: existing[0], duplicate: true };
  }

  const [request] = await db
    .insert(collaborationRequestsTable)
    .values({ senderId, receiverId, message, status: "pending" })
    .returning();

  const sender = await getUserWithCounts(senderId, null);
  const receiver = await getUserWithCounts(receiverId, null);

  return {
    request: { ...request, sender, receiver },
    duplicate: false,
  };
}

export async function getReceivedRequests(userId: number) {
  const requests = await db
    .select()
    .from(collaborationRequestsTable)
    .where(eq(collaborationRequestsTable.receiverId, userId));

  return Promise.all(
    requests.map(async r => {
      const sender = await getUserWithCounts(r.senderId, userId);
      return { ...r, sender };
    })
  );
}

export async function getSentRequests(userId: number) {
  const requests = await db
    .select()
    .from(collaborationRequestsTable)
    .where(eq(collaborationRequestsTable.senderId, userId));

  return Promise.all(
    requests.map(async r => {
      const receiver = await getUserWithCounts(r.receiverId, userId);
      return { ...r, receiver };
    })
  );
}

export async function updateRequestStatus(
  id: number,
  userId: number,
  status: "accepted" | "rejected"
) {
  const [request] = await db
    .select()
    .from(collaborationRequestsTable)
    .where(eq(collaborationRequestsTable.id, id));

  if (!request) return null;
  if (request.receiverId !== userId) throw new Error("Forbidden");
  if (request.status !== "pending") throw new Error("RequestResolved");

  const [updated] = await db
    .update(collaborationRequestsTable)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(collaborationRequestsTable.id, id), eq(collaborationRequestsTable.status, "pending")))
    .returning();
  if (!updated) throw new Error("RequestResolved");

  if (status === "accepted") {
    const { conversationId } = await startConversation(request.senderId, request.receiverId);
    await sendMessage(request.receiverId, {
      conversationId,
      content: `I accepted your collaboration request! Let's connect.`,
    });
  }

  const sender = await getUserWithCounts(updated.senderId, userId);
  return { ...updated, sender };
}

function canAccessRoom(roomRequest: { senderId: number; receiverId: number }, userId: number) {
  return roomRequest.senderId === userId || roomRequest.receiverId === userId;
}

export async function getRooms(userId: number) {
  const requests = await db
    .select()
    .from(collaborationRequestsTable)
    .where(and(or(eq(collaborationRequestsTable.senderId, userId), eq(collaborationRequestsTable.receiverId, userId)), eq(collaborationRequestsTable.status, "accepted")));
  const applications = await db.select({
    id: opportunityApplicationsTable.id,
    jobId: opportunityApplicationsTable.jobId,
    applicantId: opportunityApplicationsTable.applicantId,
    status: opportunityApplicationsTable.status,
    completedAt: opportunityApplicationsTable.completedAt,
    title: jobsTable.title,
    authorId: jobsTable.authorId,
  }).from(opportunityApplicationsTable)
    .innerJoin(jobsTable, eq(jobsTable.id, opportunityApplicationsTable.jobId))
    .where(and(
      or(eq(opportunityApplicationsTable.applicantId, userId), eq(jobsTable.authorId, userId)),
      inArray(opportunityApplicationsTable.status, ["accepted", "completed"]),
    ));
  const requestIds = requests.map(request => request.id);
  const applicationIds = applications.map(application => application.id);
  if (requestIds.length === 0 && applicationIds.length === 0) return [];

  const roomConditions = [
    ...(requestIds.length ? [inArray(collaborationRoomsTable.requestId, requestIds)] : []),
    ...(applicationIds.length ? [inArray(collaborationRoomsTable.opportunityApplicationId, applicationIds)] : []),
  ];
  const rooms = await db.select().from(collaborationRoomsTable)
    .where(and(or(...roomConditions), inArray(collaborationRoomsTable.status, ["active", "completed"])))
    .orderBy(desc(collaborationRoomsTable.updatedAt));
  const requestById = new Map(requests.map(request => [request.id, request]));
  const applicationById = new Map(applications.map(application => [application.id, application]));
  return rooms.map(room => ({
    ...room,
    request: room.requestId === null ? null : requestById.get(room.requestId) ?? null,
    opportunity: room.opportunityApplicationId === null ? null : applicationById.get(room.opportunityApplicationId) ?? null,
  }));
}

export async function createRoom(userId: number, input: { requestId: number; title: string; brief?: string; splitSuggestion?: Record<string, number> }) {
  const [request] = await db.select().from(collaborationRequestsTable).where(and(eq(collaborationRequestsTable.id, input.requestId), eq(collaborationRequestsTable.status, "accepted")));
  if (!request) return { kind: "missing" as const };
  if (!canAccessRoom(request, userId)) return { kind: "forbidden" as const };

  const [existing] = await db.select().from(collaborationRoomsTable).where(eq(collaborationRoomsTable.requestId, input.requestId));
  if (existing) return { kind: "exists" as const, room: existing };

  await db.insert(collaborationRoomsTable).values({
    requestId: input.requestId,
    createdById: userId,
    title: input.title,
    brief: input.brief ?? "",
    splitSuggestion: input.splitSuggestion ?? {},
  }).onConflictDoNothing({ target: collaborationRoomsTable.requestId });
  const [room] = await db.select().from(collaborationRoomsTable).where(eq(collaborationRoomsTable.requestId, input.requestId));
  return room ? { kind: existing ? "exists" as const : "created" as const, room } : { kind: "missing" as const };
}

export async function updateRoom(userId: number, roomId: number, input: { title?: string; brief?: string; splitSuggestion?: Record<string, number> }) {
  const [room] = await db.select().from(collaborationRoomsTable).where(eq(collaborationRoomsTable.id, roomId));
  if (!room || room.status === "cancelled") return { kind: "missing" as const };
  if (room.requestId !== null) {
    const [request] = await db.select().from(collaborationRequestsTable)
      .where(and(eq(collaborationRequestsTable.id, room.requestId), eq(collaborationRequestsTable.status, "accepted")));
    if (!request) return { kind: "missing" as const };
    if (!canAccessRoom(request, userId)) return { kind: "forbidden" as const };
  } else if (room.opportunityApplicationId !== null) {
    const [application] = await db.select({
      applicantId: opportunityApplicationsTable.applicantId,
      status: opportunityApplicationsTable.status,
      authorId: jobsTable.authorId,
    }).from(opportunityApplicationsTable)
      .innerJoin(jobsTable, eq(jobsTable.id, opportunityApplicationsTable.jobId))
      .where(and(
        eq(opportunityApplicationsTable.id, room.opportunityApplicationId),
        inArray(opportunityApplicationsTable.status, ["accepted", "completed"]),
      ));
    if (!application) return { kind: "missing" as const };
    if (!canAccessOpportunityWorkspace(application.status, application.authorId === userId, application.applicantId === userId)) {
      return application.applicantId === userId || application.authorId === userId
        ? { kind: "missing" as const }
        : { kind: "forbidden" as const };
    }
  } else {
    return { kind: "missing" as const };
  }

  const [updated] = await db.update(collaborationRoomsTable).set({ ...input, updatedAt: new Date() }).where(eq(collaborationRoomsTable.id, roomId)).returning();
  return { kind: "updated" as const, room: updated };
}
