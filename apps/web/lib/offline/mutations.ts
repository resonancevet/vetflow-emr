"use client";

import {
  enqueueOfflineMutation,
  listOfflineOutbox,
  markOfflineOutboxAttempt,
  removeOfflineOutboxItem,
  type OfflineOutboxItem,
} from "@/lib/offline/outbox";

type ReplayResult =
  | { status: "replayed"; item: OfflineOutboxItem }
  | { status: "failed"; item: OfflineOutboxItem; error: string }
  | { status: "skipped"; item: OfflineOutboxItem };

export function isNetworkError(error: unknown) {
  if (!navigator.onLine) return true;
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return true;
  }
  if (error instanceof Error && /network|offline|failed to fetch/i.test(error.message)) {
    return true;
  }
  return false;
}

export async function runOrQueueMutation<TPayload, TResult>(input: {
  target: string;
  payload: TPayload;
  runOnline: (payload: TPayload) => Promise<TResult>;
  shouldQueue?: (error: unknown) => boolean;
}): Promise<
  | { status: "online"; result: TResult }
  | { status: "queued"; item: OfflineOutboxItem }
> {
  if (!navigator.onLine) {
    const item = await enqueueOfflineMutation({
      target: input.target,
      payload: input.payload,
    });
    return { status: "queued", item };
  }

  try {
    const result = await input.runOnline(input.payload);
    return { status: "online", result };
  } catch (error) {
    const shouldQueue = input.shouldQueue ?? isNetworkError;
    if (!shouldQueue(error)) throw error;

    const item = await enqueueOfflineMutation({
      target: input.target,
      payload: input.payload,
    });
    return { status: "queued", item };
  }
}

export async function drainOfflineOutbox(replayers: Record<
  string,
  (item: OfflineOutboxItem) => Promise<void>
>): Promise<ReplayResult[]> {
  if (!navigator.onLine) return [];

  const items = await listOfflineOutbox();
  const results: ReplayResult[] = [];

  for (const item of items) {
    const replayer = replayers[item.target];
    if (!replayer) {
      results.push({ status: "skipped", item });
      continue;
    }

    try {
      await replayer(item);
      await removeOfflineOutboxItem(item);
      results.push({ status: "replayed", item });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to replay queued item";
      await markOfflineOutboxAttempt(item, message);
      results.push({ status: "failed", item, error: message });
    }
  }

  return results;
}
