import type { ReviewReply } from '../api/feed';

export type ThreadedReply = {
  depth: number;
  reply: ReviewReply;
};

export function flattenReviewReplies(items: ReviewReply[]): ThreadedReply[] {
  const itemIds = new Set(items.map((item) => item.id));
  const children = new Map<string, ReviewReply[]>();
  const roots: ReviewReply[] = [];

  items.forEach((item) => {
    if (!item.parentReplyId || !itemIds.has(item.parentReplyId)) {
      roots.push(item);
      return;
    }
    const siblings = children.get(item.parentReplyId) ?? [];
    siblings.push(item);
    children.set(item.parentReplyId, siblings);
  });

  const threaded: ThreadedReply[] = [];
  const visited = new Set<string>();
  const visit = (reply: ReviewReply, depth: number) => {
    if (visited.has(reply.id)) return;
    visited.add(reply.id);
    threaded.push({ depth, reply });
    children.get(reply.id)?.forEach((child) => visit(child, depth + 1));
  };
  roots.forEach((reply) => visit(reply, 0));
  items.forEach((reply) => visit(reply, 0));
  return threaded;
}
