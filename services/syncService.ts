import { SyncAction } from "../types";

const CHANNEL_NAME = 'tube_party_sync_channel_v1';
const channel = new BroadcastChannel(CHANNEL_NAME);

export const broadcast = (action: SyncAction) => {
  try {
    channel.postMessage(action);
  } catch (e) {
    console.error("Broadcast failed", e);
  }
};

export const listen = (callback: (action: SyncAction) => void) => {
  channel.onmessage = (event) => {
    if (event.data) {
      callback(event.data);
    }
  };
  return () => {
    channel.onmessage = null;
  };
};