import { P2PRoom } from "@/lib/multiplayer";
import { getPose } from "./slam";
import { tracker } from "./tracker";
import { roomList, ingestRemote } from "./room";

let room: P2PRoom | null = null;
let lastPeers = 0;
let remote: { pose: { x: number; y: number; yaw: number }; n: number } | null = null;

export function remoteCraft() {
  return remote;
}

export function meshPeers() {
  return lastPeers;
}

export async function joinMesh(code: string) {
  room?.close();
  const id = Math.random().toString(36).slice(2, 8);
  room = new P2PRoom({
    room: `aether-${code.replace(/[^a-z0-9_-]/gi, "").slice(0, 24) || "eyes"}`,
    selfId: id,
    name: "craft",
    onPeersChanged: (peers) => {
      lastPeers = peers.length;
    },
    onMessage: (_from, data) => {
      try {
        const msg = typeof data === "string" ? JSON.parse(data) : data;
        if (msg && msg.pose) remote = msg;
        if (msg?.memories) ingestRemote(msg.memories);
        if (msg?.tracks) tracker.adoptRemote(msg.tracks);
      } catch {
        /* ignore */
      }
    },
  });
  await room.join();
}

export function leaveMesh() {
  room?.close();
  room = null;
  lastPeers = 0;
  remote = null;
}

export function tickMesh() {
  if (!room) return;
  room.broadcast({
    pose: getPose(),
    n: roomList().length,
    t: Date.now(),
    memories: roomList().slice(0, 24).map((m) => ({ id: m.id, class: m.class, name: m.name, wx: m.wx, wy: m.wy })),
    tracks: tracker.exportRemote(),
  });
}
