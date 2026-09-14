# FieldVault + Aether

Phone-first site capture (FieldVault) and a browser cortex with eyes, craft, and life (Aether). Offline-first. No accounts.

## Apps

| Path | What |
|---|---|
| `/` | Studio home — FieldVault, Aether mind |
| `/apps/fieldvault` | About — preview widgets (capture, FixPlot, export) |
| `/apps/fieldvault/play` | Walkdown — guided shots, FixPlot GPS, WalkScore, punch list, named export |
| `/apps/aether` | Operator home: on-device memory, draft cards, confirm-to-fulfill |
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
- Operator memory / lessons / receipts stay in LocalStorage on this device — no cloud account
- Confirm phrases (`order it` / `do it` / `call them` / `buy it` / `send it` / `go`) run the best handoff available: clipboard, maps/search URL, `tel:`, optional share — not DoorDash/Amazon checkout APIs
- Food and parts fulfillment never invents a confirmation number; if a vendor login or payment method is missing, status is `needs_connector` with the gap named
- Project-brain maps existing repo paths only (FieldVault / Eyes / Craft); it proposes next steps and does not rewrite those modules or flash hardware

## Layout

```
src/fieldvault   walkdown capture
src/aether       assistant, cortex, dial, operator loop
src/vision       detector, tracker, Lookout, Craft
src/components/site   studio pages + Aether mind / operator home
public/models    optional YOLO shards
```

Operator storage key: `aether:operator` (memories, draft cards, project attach, receipts).
