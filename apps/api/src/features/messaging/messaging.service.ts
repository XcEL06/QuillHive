import { db } from "@workspace/db";
import {
  conversationsTable,
  conversationParticipantsTable,
  messagesTable,
  usersTable,
  followsTable,
  paymentProposalsTable,
} from "@workspace/db/schema";
import { eq, and, desc, ne, isNull, inArray } from "drizzle-orm";
import { getUserWithCounts } from "../profiles/profile.service";
import { emitToConversation, emitToUser } from "../../lib/socket";
import { getOfficialSystemAccountId } from "../../lib/officialSystemAccount";

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
      if (conv.requestRecipientId === viewerId && conv.requestStatus !== "accepted") return null;

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

export async function getMessageRequests(viewerId: number) {
  const pending = await db
    .select()
    .from(conversationsTable)
    .where(and(
      eq(conversationsTable.requestRecipientId, viewerId),
      eq(conversationsTable.requestStatus, "pending_request"),
    ));

  const requests = await Promise.all(pending.map(async conv => {
    const participants = await db
      .select()
      .from(conversationParticipantsTable)
      .where(eq(conversationParticipantsTable.conversationId, conv.id));
    const requesterId = participants.find(participant => participant.userId !== viewerId)?.userId;
    if (!requesterId) return null;
    const requester = await getUserWithCounts(requesterId, viewerId);
    const [lastMessage] = await db
      .select({ createdAt: messagesTable.createdAt })
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conv.id))
      .orderBy(desc(messagesTable.createdAt))
      .limit(1);
    return {
      id: conv.id,
      requester,
      createdAt: conv.createdAt,
      lastMessageAt: lastMessage?.createdAt ?? conv.createdAt,
    };
  }));
  return requests
    .filter((request): request is NonNullable<typeof request> => request !== null)
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
}

async function getRequestRecipientId(senderId: number, recipientId: number) {
  const [recipient] = await db
    .select({ allowMessagesFromAnyone: usersTable.allowMessagesFromAnyone })
    .from(usersTable)
    .where(eq(usersTable.id, recipientId));
  if (!recipient || recipient.allowMessagesFromAnyone) return null;

  const [followsSender] = await db
    .select({ id: followsTable.followerId })
    .from(followsTable)
    .where(and(
      eq(followsTable.followerId, recipientId),
      eq(followsTable.followingId, senderId),
    ));
  return followsSender ? null : recipientId;
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
      return {
        conversationId: conv.id,
        existing: true,
        requestStatus: conv.requestStatus,
        requestRecipientId: conv.requestRecipientId,
      };
    }
  }

  const [newConv] = await db.insert(conversationsTable).values({ isGroup: false }).returning();
  await db.insert(conversationParticipantsTable).values([
    { conversationId: newConv.id, userId: viewerId, unreadCount: 0 },
    { conversationId: newConv.id, userId: targetUserId, unreadCount: 0 },
  ]);

  return {
    conversationId: newConv.id,
    existing: false,
    requestStatus: newConv.requestStatus,
    requestRecipientId: newConv.requestRecipientId,
  };
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

  const [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, convId));
  if (
    conversation?.requestRecipientId === viewerId
    && conversation.requestStatus !== "accepted"
  ) throw new Error("RequestPending");

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
  const participations = await db
    .select()
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.userId, userId));
  if (participations.length === 0) return 0;

  const normalConversations = await db
    .select({ id: conversationsTable.id })
    .from(conversationsTable)
    .where(and(
      eq(conversationsTable.requestStatus, "accepted"),
      inArray(conversationsTable.id, participations.map(participation => participation.conversationId)),
    ));
  const normalConversationIds = new Set(normalConversations.map(conversation => conversation.id));
  return participations.reduce((sum, participation) => (
    normalConversationIds.has(participation.conversationId)
      ? sum + (Number(participation.unreadCount) || 0)
      : sum
  ), 0);
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
  const [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, convId));
  if (
    conversation?.requestRecipientId === viewerId
    && conversation.requestStatus !== "accepted"
  ) throw new Error("RequestPending");

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
    const conversation = await startConversation(viewerId, data.recipientId);
    convId = conversation.conversationId;
  }

  if (convId) {
    const participants = await db
      .select()
      .from(conversationParticipantsTable)
      .where(eq(conversationParticipantsTable.conversationId, convId));
    if (!participants.some((participant) => participant.userId === viewerId)) {
      throw new Error("Forbidden");
    }

    let [conversation] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, convId));
    if (!conversation) throw new Error("Forbidden");

    const [existingMessage] = await db
      .select({ id: messagesTable.id })
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, convId))
      .limit(1);
    if (
      !conversation.isGroup
      && conversation.requestStatus === "accepted"
      && !existingMessage
      && participants.length === 2
    ) {
      const recipientId = participants.find(participant => participant.userId !== viewerId)?.userId;
      if (recipientId) {
        const requestRecipientId = await getRequestRecipientId(viewerId, recipientId);
        if (requestRecipientId) {
          [conversation] = await db
            .update(conversationsTable)
            .set({ requestStatus: "pending_request", requestRecipientId, updatedAt: new Date() })
            .where(eq(conversationsTable.id, convId))
            .returning();
        }
      }
    }

    if (
      conversation.requestStatus === "declined"
      || (
        conversation.requestStatus === "pending_request"
        && conversation.requestRecipientId === viewerId
      )
    ) throw new Error("RequestPending");

    if (conversation.requestStatus === "pending_request") {
      if (existingMessage) throw new Error("RequestPending");
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

  const [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, convId!));
  const pendingRecipientId = conversation?.requestStatus === "pending_request"
    ? conversation.requestRecipientId
    : null;
  if (pendingRecipientId) {
    emitToUser(viewerId, "message:receive", enrichedMessage);
    emitToUser(pendingRecipientId, "message:request", { conversationId: convId });
  } else {
    emitToConversation(convId!, "message:receive", enrichedMessage);
  }

  const allParticipants = await db
    .select()
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.conversationId, convId!));

  for (const p of allParticipants) {
    if (p.userId !== viewerId) {
      if (p.userId !== pendingRecipientId) {
        emitToUser(p.userId, "notification:new", {
          type: "message",
          conversationId: convId,
          sender,
          message: data.content.substring(0, 80),
        });
      }
    }
  }

  return enrichedMessage;
}

export async function sendAdminMessage(targetUserId: number, content: string) {
  const [target] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.id, targetUserId), eq(usersTable.isDeleted, false)))
    .limit(1);
  if (!target) throw new Error("User not found");

  const officialAccountId = await getOfficialSystemAccountId();
  if (officialAccountId === targetUserId) throw new Error("Cannot message the official system account");

  const conversation = await startConversation(officialAccountId, targetUserId);
  const message = await sendMessage(officialAccountId, { conversationId: conversation.conversationId, content });
  return { conversationId: conversation.conversationId, message };
}

async function requireConversationParticipant(conversationId: number, userId: number) {
  const participants = await db.select().from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.conversationId, conversationId));
  if (!participants.some((participant) => participant.userId === userId)) throw new Error("Forbidden");
  const [conversation] = await db.select().from(conversationsTable)
    .where(eq(conversationsTable.id, conversationId));
  if (conversation?.requestStatus !== "accepted") throw new Error("RequestPending");
  return participants;
}

export async function respondToMessageRequest(conversationId: number, recipientId: number, action: "accept" | "decline") {
  const nextStatus = action === "accept" ? "accepted" : "declined";
  const [updated] = await db
    .update(conversationsTable)
    .set({ requestStatus: nextStatus, updatedAt: new Date() })
    .where(and(
      eq(conversationsTable.id, conversationId),
      eq(conversationsTable.requestRecipientId, recipientId),
      eq(conversationsTable.requestStatus, "pending_request"),
    ))
    .returning({ id: conversationsTable.id, requestStatus: conversationsTable.requestStatus });
  if (!updated) throw new Error("Not found");

  const participants = await db
    .select({ userId: conversationParticipantsTable.userId })
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.conversationId, conversationId));
  if (action === "accept") {
    for (const participant of participants) {
      emitToUser(participant.userId, "message:request-updated", { conversationId, requestStatus: nextStatus });
    }
  }
  return updated;
}

export async function getPaymentProposals(conversationId: number, viewerId: number) {
  await requireConversationParticipant(conversationId, viewerId);
  return db.select().from(paymentProposalsTable)
    .where(eq(paymentProposalsTable.conversationId, conversationId))
    .orderBy(paymentProposalsTable.createdAt);
}

export async function createPaymentProposal(data: {
  conversationId: number;
  proposerId: number;
  amount: number;
  currency: string;
  note?: string;
}) {
  const participants = await requireConversationParticipant(data.conversationId, data.proposerId);
  const [proposal] = await db.insert(paymentProposalsTable).values({
    conversationId: data.conversationId,
    proposerId: data.proposerId,
    amount: data.amount,
    currency: data.currency.toUpperCase(),
    note: data.note?.trim() || null,
    status: "proposed",
  }).returning();
  return { proposal, recipientIds: participants.filter((participant) => participant.userId !== data.proposerId).map((participant) => participant.userId) };
}

export async function updatePaymentProposal(proposalId: number, viewerId: number, status: "accepted" | "rejected") {
  const [proposal] = await db.select().from(paymentProposalsTable).where(eq(paymentProposalsTable.id, proposalId));
  if (!proposal) throw new Error("Not found");
  await requireConversationParticipant(proposal.conversationId, viewerId);
  const [updated] = await db.update(paymentProposalsTable).set({ status }).where(eq(paymentProposalsTable.id, proposalId)).returning();
  return updated;
}
