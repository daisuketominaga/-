export type SyncMessageType =
  | "VALUE_WORK_PROGRESS"
  | "VALUE_WORK_COMPLETE"
  | "SESSION_UPDATE"
  | "VALUE_MAP_READY"
  | "NOTE_ADDED";

export interface SyncMessage {
  type: SyncMessageType;
  sessionId: string;
  data?: unknown;
}

export function createSyncChannel(sessionId: string) {
  if (typeof window === "undefined") {
    return {
      send: () => {},
      onMessage: () => () => {},
      close: () => {},
    };
  }

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(`ichien-sync-${sessionId}`);
  } catch {
    // BroadcastChannel not supported — fall back to storage events
  }

  return {
    send(msg: SyncMessage) {
      if (channel) {
        channel.postMessage(msg);
      } else {
        localStorage.setItem(
          `ichien-sync-event-${sessionId}`,
          JSON.stringify({ ...msg, _ts: Date.now() })
        );
      }
    },

    onMessage(handler: (msg: SyncMessage) => void): () => void {
      if (channel) {
        const listener = (e: MessageEvent<SyncMessage>) => handler(e.data);
        channel.addEventListener("message", listener);
        return () => channel?.removeEventListener("message", listener);
      }

      const storageKey = `ichien-sync-event-${sessionId}`;
      const storageListener = (e: StorageEvent) => {
        if (e.key === storageKey && e.newValue) {
          try {
            handler(JSON.parse(e.newValue));
          } catch {}
        }
      };
      window.addEventListener("storage", storageListener);
      return () => window.removeEventListener("storage", storageListener);
    },

    close() {
      channel?.close();
    },
  };
}
