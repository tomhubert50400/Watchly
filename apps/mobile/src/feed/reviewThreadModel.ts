import type { ReviewReply } from '../api/feed';

export type ThreadedReply = {
  ancestorHasNextSibling: boolean[];
  depth: number;
  isLastChild: boolean;
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
  const visit = (
    reply: ReviewReply,
    depth: number,
    ancestorHasNextSibling: boolean[],
    isLastChild: boolean,
  ) => {
    if (visited.has(reply.id)) return;
    visited.add(reply.id);
    threaded.push({ ancestorHasNextSibling, depth, isLastChild, reply });
    const nested = children.get(reply.id) ?? [];
    nested.forEach((child, index) => visit(
      child,
      depth + 1,
      depth === 0 ? [] : [...ancestorHasNextSibling, !isLastChild],
      index === nested.length - 1,
    ));
  };
  roots.forEach((reply, index) => visit(reply, 0, [], index === roots.length - 1));
  items.forEach((reply) => visit(reply, 0, [], true));
  return threaded;
}
