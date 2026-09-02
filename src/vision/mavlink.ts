import { getPose } from "./slam";
import { getLastFrame } from "@/aether/bus";
import { lastFail } from "@/aether/fail";

/** JSON stand-in for a MAVLink stream. Not a radio. */

export function mavlinkDoc() {
  const pose = getPose();
  const frame = getLastFrame();
  const fail = lastFail();
  return {
    protocol: "aether-mavlink-json",
    t: Date.now(),
    heartbeat: { type: "GCS", autopilot: "aether" },
    attitude: { yaw: pose.yaw, x: pose.x, y: pose.y },
    nav: { block: frame?.block || false, seek: frame?.seek || null },
    failsafe: fail,
    nmea: `$GPGGA,${new Date().toISOString()},${pose.y.toFixed(4)},N,${pose.x.toFixed(4)},E,1,08,1.0,0.0,M,0.0,M,,`,
  };
}

export function downloadMavlink() {
  const body = JSON.stringify(mavlinkDoc(), null, 2);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type: "application/json" }));
  a.download = "aether-mavlink.json";
  a.click();
  return body;
}
