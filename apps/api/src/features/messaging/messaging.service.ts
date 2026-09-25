import { db } from "@workspace/db";
import {
  conversationsTable,
  conversationParticipantsTable,
  messagesTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, and, desc, ne, isNull } from "drizzle-orm";
import { getUserWithCounts } from "../profiles/profile.service";
import { emitToConversation, emitToUser } from "../../lib/socket";

export async function getConversations(viewerId: number) {
  const participations = await db
    .select()
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.userId, viewerId));

  const conversations = await Promise.all(
    participations.map(async p => {
      const [conv] = await db
        .select()
        .from(conversationsTable)
        .where(eq(conversationsTable.id, p.conversationId));
      if (!conv) return null;

      const participants = await db
        .select()
        .from(conversationParticipantsTable)
        .where(eq(conversationParticipantsTable.conversationId, conv.id));

      const participantUsers = await Promise.all(
        participants.filter(p2 => p2.userId !== viewerId).map(p2 => getUserWithCounts(p2.userId, viewerId))
      );

      const [lastMessage] = await db
        .select()
        .from(messagesTable)
        .where(eq(messagesTable.conversationId, conv.id))
        .orderBy(desc(messagesTable.createdAt))
        .limit(1);

      let enrichedLastMessage: (typeof lastMessage & { sender: unknown }) | null = null;
      if (lastMessage) {
        const sender = await getUserWithCounts(lastMessage.senderId, null);
        enrichedLastMessage = { ...lastMessage, sender };
      }

      return {
        ...conv,
        participants: participantUsers.filter(Boolean),
        lastMessage: enrichedLastMessage,
        unreadCount: p.unreadCount,
      };
    })
  );

  return conversations
    .filter(Boolean)
    .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function startConversation(viewerId: number, targetUserId: number) {
  const myParticipations = await db
    .select()
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.userId, viewerId));

  for (const p of myParticipations) {
    const [conv] = await db
      .select()
      .from(conversationsTable)
      .where(and(eq(conversationsTable.id, p.conversationId), eq(conversationsTable.isGroup, false)));
    if (!conv) continue;

    const participants = await db
      .select()
      .from(conversationParticipantsTable)
      .where(eq(conversationParticipantsTable.conversationId, conv.id));

    const ids = participants.map(p2 => p2.userId);
    if (ids.includes(viewerId) && ids.includes(targetUserId) && participants.length === 2) {
      return { conversationId: conv.id, existing: true };
    }
  }

  const [newConv] = await db.insert(conversationsTable).values({ isGroup: false }).returning();
  await db.insert(conversationParticipantsTable).values([
    { conversationId: newConv.id, userId: viewerId, unreadCount: 0 },
    { conversationId: newConv.id, userId: targetUserId, unreadCount: 0 },
  ]);

  return { conversationId: newConv.id, existing: false };
}

export async function getConversationMessages(convId: number, viewerId: number) {
  const participation = await db
    .select()
    .from(conversationParticipantsTable)
    .where(
      and(
        eq(conversationParticipantsTable.conversationId, convId),
        eq(conversationParticipantsTable.userId, viewerId)
      )
    );
  if (participation.length === 0) throw new Error("Forbidden");

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, convId))
    .orderBy(messagesTable.createdAt);

  const enriched = await Promise.all(
    messages.map(async m => {
      const sender = await getUserWithCounts(m.senderId, null);
      return { ...m, sender };
    })
  );

  await db
    .update(conversationParticipantsTable)
    .set({ unreadCount: 0 })
    .where(
      and(
        eq(conversationParticipantsTable.conversationId, convId),
        eq(conversationParticipantsTable.userId, viewerId)
      )
    );

  return enriched;
}

export async function getUnreadMessageCount(userId: number): Promise<number> {
  const rows = await db
    .select({ unreadCount: conversationParticipantsTable.unreadCount })
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.userId, userId));
  return rows.reduce((sum, r) => sum + (Number(r.unreadCount) || 0), 0);
}

export async function markConversationSeen(convId: number, viewerId: number) {
  const participation = await db
    .select()
    .from(conversationParticipantsTable)
    .where(
      and(
        eq(conversationParticipantsTable.conversationId, convId),
        eq(conversationParticipantsTable.userId, viewerId)
      )
    );

  if (participation.length === 0) throw new Error("Forbidden");

  const now = new Date();

  const updatedMessages = await db
    .update(messagesTable)
    .set({ seenAt: now })
    .where(
      and(
        eq(messagesTable.conversationId, convId),
        ne(messagesTable.senderId, viewerId),
        isNull(messagesTable.seenAt)
      )
    )
    .returning({ id: messagesTable.id, senderId: messagesTable.senderId, seenAt: messagesTable.seenAt });

  await db
    .update(conversationParticipantsTable)
    .set({ unreadCount: 0 })
    .where(
      and(
        eq(conversationParticipantsTable.conversationId, convId),
        eq(conversationParticipantsTable.userId, viewerId)
      )
    );

  const otherParticipants = await db
    .select({ userId: conversationParticipantsTable.userId })
    .from(conversationParticipantsTable)
    .where(
      and(
        eq(conversationParticipantsTable.conversationId, convId),
        ne(conversationParticipantsTable.userId, viewerId)
      )
    );

  for (const p of otherParticipants) {
    emitToUser(p.userId, "messages:seen", {
      conversationId: convId,
      seenAt: now.toISOString(),
      messageIds: updatedMessages.map(m => m.id),
    });
  }

  return { conversationId: convId, seenAt: now.toISOString(), updatedCount: updatedMessages.length };
}

export async function sendMessage(
  viewerId: number,
  data: { conversationId?: number; recipientId?: number; content: string }
) {
  let convId = data.conversationId;

  if (!convId && data.recipientId) {
    const [newConv] = await db.insert(conversationsTable).values({ isGroup: false }).returning();
    convId = newConv.id;
    await db.insert(conversationParticipantsTable).values([
      { conversationId: convId, userId: viewerId, unreadCount: 0 },
      { conversationId: convId, userId: data.recipientId, unreadCount: 1 },
    ]);
  } else if (convId) {
    const participants = await db
      .select()
      .from(conversationParticipantsTable)
      .where(eq(conversationParticipantsTable.conversationId, convId));
    if (!participants.some((participant) => participant.userId === viewerId)) {
      throw new Error("Forbidden");
    }

    await Promise.all(
      participants
        .filter(p => p.userId !== viewerId)
        .map(p =>
          db
            .update(conversationParticipantsTable)
            .set({ unreadCount: p.unreadCount + 1 })
            .where(eq(conversationParticipantsTable.id, p.id))
        )
    );
  }

  const [message] = await db
    .insert(messagesTable)
    .values({
      conversationId: convId!,
      senderId: viewerId,
      content: data.content,
      deliveredAt: new Date(),
    })
    .returning();

  await db
    .update(conversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(conversationsTable.id, convId!));

  const sender = await getUserWithCounts(viewerId, null);
  const enrichedMessage = { ...message, sender };

  emitToConversation(convId!, "message:receive", enrichedMessage);

  const allParticipants = await db
    .select()
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.conversationId, convId!));

  for (const p of allParticipants) {
    if (p.userId !== viewerId) {
      emitToUser(p.userId, "notification:new", {
        type: "message",
        conversationId: convId,
        sender,
        message: data.content.substring(0, 80),
      });
    }
  }

  return enrichedMessage;
}

export async function sendAdminMessage(adminId: number, targetUserId: number, content: string) {
  const [target] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.id, targetUserId), eq(usersTable.isDeleted, false)))
    .limit(1);
  if (!target) throw new Error("User not found");

  const [newConversation] = await db.insert(conversationsTable).values({ isGroup: false }).returning();
  await db.insert(conversationParticipantsTable).values([
    { conversationId: newConversation.id, userId: adminId, unreadCount: 0 },
    { conversationId: newConversation.id, userId: targetUserId, unreadCount: 1 },
  ]);

  return sendMessage(adminId, { conversationId: newConversation.id, content });
}
