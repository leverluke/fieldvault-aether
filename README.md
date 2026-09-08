# FieldVault + Aether

Phone-first site capture (FieldVault) and a browser cortex with eyes, craft, and life (Aether). Offline-first. No accounts.

## Apps

| Path | What |
|---|---|
| `/` | Studio home — FieldVault, Aether mind |
| `/apps/fieldvault` | About — preview widgets (capture, FixPlot, export) |
| `/apps/fieldvault/play` | Walkdown — guided shots, FixPlot GPS, WalkScore, punch list, named export |
| `/apps/aether` | Cortex: 14 subagents, mind diagram |
| `/apps/aether/see` | Eyes — YOLO + COCO, ByteTrack IDs, teach, LOCK/COAST |
| `/apps/aether/craft` | Hull-agnostic autopilot (air / water / ground) |

## Run

```bash
npm install
npm run dev
```

Dev server: `0.0.0.0:8080`. Phone GPS and camera need HTTPS or `localhost`.

```bash
npm run typecheck
npm run build
```

## Stack

- TanStack Start + Vite
- TensorFlow.js (COCO-SSD, MobileNet), optional YOLOv8n at `public/models/yolov8n`
- IndexedDB for FieldVault
- LocalStorage for Aether memory (contacts, teach bank, graves)

## Honest limits

- Eyes are browser COCO/YOLO, not YOLO-World / LiDAR
- Twilio call bridge needs SID, token, from-number in Aether calling settings
- Craft is a simulated hull in the tab, not MAVLink to a vehicle
- Aether does not sit on the restaurant line — it drafts and hands you Call

## Layout

```
src/fieldvault   walkdown capture
src/aether       assistant, cortex, dial
src/vision       detector, tracker, Lookout, Craft
src/components/site   studio pages + Aether mind
public/models    optional YOLO shards
```

Cloud Agent connectivity test: this line was added by a Cursor Cloud Agent and can be removed.
