// @ts-nocheck
import { L, JSZip, ensureFieldVaultLibs } from "./libs.ts";
/* FieldVault v3 – Expanded local-first version */
/* FieldVault v3 – Expanded local-first version */
const DB_NAME = 'FieldVaultDB';
const DB_VERSION = 2;
const STORE_VISITS = 'visits';
const STORE_AREAS = 'areas';
const STORE_EQUIPMENT = 'equipment';

let db = null;
let currentView = 'visits';
let currentVisitId = null;
let currentAreaId = null;
let currentEquipmentId = null;
let currentPhotoId = null;
let markupTool = 'pen';
let isDrawing = false;
let lastX = 0, lastY = 0;
let qcPhotos = [];
let assignSelectedPhotoIds = new Set();
let assignTargetEquipmentId = null;
let recognition = null;
let currentVoiceTarget = null;
let selectedCondition = '';
let selectedPriority = '';
let highVis = false;
let mapInstance = null;
let mapMarkers = [];
let currentMapLayer = 'satellite';
let lastAiResult = '';
let aiPhotoTargetId = null;

let productMode = 'commercial';

const COPY = {
  commercial: {
    modeName: 'Commercial',
    pill: 'O&G',
    banner: 'Oil & gas field notes — photograph equipment, tag it, and leave with a client-ready package.',
    emptyTitle: 'Start your first site visit',
    emptyBody: 'Walk the unit, snap photos of what you see, and FieldVault will help you organize them for the office.',
    emptyCta: 'Create First Visit',
    newVisitBtn: '+ Visit',
    completenessTitle: 'How complete is this visit?',
    readyBtn: "What's missing?",
    readyHeader: "What's missing?",
    readyMeta: "Finish these before you leave the site so the office isn't chasing photos later.",
    readyAllGood: "You're good to leave",
    readyAllGoodBody: 'Required photos are in place. Generate the report when you are back.',
    readyBack: 'Back to Visit',
    photoPromptsTitle: 'Photos to take',
    photoPromptHelp: 'Tap Take on a row. Start with a wide shot and the nameplate — those two matter most.',
    followup: 'Flag as “Needs follow-up photos”',
    eqNotesPh: 'What you noticed: leaks, missing tags, access issues, anything the office should know…',
    visitNotesPh: 'Weather, unit status, who you met, anything unusual…',
    visitTitlePh: 'e.g. Crude unit walkdown – May 12',
    qcHelp: 'Take a burst of photos now. Assign them to pumps, valves, and tanks afterward.',
    walkMeta: 'Photos in the order you took them — useful when you reconstruct the walk.',
    exportBtn: 'Export Package',
    reportBtn: 'Generate Report',
    suggestAreas: 'Suggest areas from GPS',
    promptOverall: '1. Overall / context view',
    promptTag: '2. Nameplate / tag close-up',
    promptDetail: '3. Detail / close-up',
    promptOther: '4. Other / additional',
    photoTypeLabel: 'What does this photo show?',
    navVisits: 'Visits',
    visitModalNew: 'New Visit',
    visitModalEdit: 'Edit Visit',
    visitTitleLabel: 'Visit Title',
    overallNotes: 'Overall Notes',
    industryTemplate: 'What kind of visit?',
    saveVisit: 'Save Visit',
    editVisit: 'Edit Visit',
    deleteVisit: 'Delete Visit',
    areasHeading: 'Areas of the plant',
    equipmentHeading: 'Equipment you documented',
    assignHelp: 'Tap the equipment, then tap the photos that belong to it.',
    clusterTitle: 'Suggested Areas',
    clusterMeta: 'Grouped by GPS proximity. Rename them to match this plant.',
    photosHelp: 'Every photo stored on this device.',
    searchPh: 'Search visits, tags, areas…',
    missingPhotos: (n) => n + ' still need photos',
    missingGps: (n) => n + ' missing a location pin',
    missingGuided: (n) => n + ' missing a wide shot or nameplate',
    pdfKind: { full: 'Site Visit', summary: 'Summary', exceptions: 'Punch List' },
    equipNoun: 'equipment',
    itemsNoun: 'items'
  },
  defense: {
    modeName: 'Defense',
    pill: 'Defense',
    banner: 'Defense mode — offline structured capture for modeling-ready / digital-twin packages. GPS and required reference views are weighted more heavily.',
    emptyTitle: 'No site collections yet',
    emptyBody: 'Create a collection to capture modeling-ready, digital-twin reference data.',
    emptyCta: 'Create First Collection',
    newVisitBtn: '+ Site',
    completenessTitle: 'Modeling Readiness',
    readyBtn: 'Ready for Processing',
    readyHeader: 'Ready for Processing?',
    readyMeta: 'Confirm GPS, required reference views, and remaining gaps before you leave the site.',
    readyAllGood: 'Collection complete',
    readyAllGoodBody: 'Required GPS and reference views are in place. Ready to export a twin package.',
    readyBack: 'Back to Site',
    photoPromptsTitle: 'Required Reference Views',
    photoPromptHelp: 'Capture these views for each asset. They count toward modeling readiness and the twin package.',
    followup: 'Flag as “Needs additional reference photos”',
    eqNotesPh: 'Geometry, materials, occlusions, access, and alignment notes for modeling…',
    visitNotesPh: 'Site conditions, capture context, and notes for the digital-twin package…',
    visitTitlePh: 'e.g. Site Alpha – Ground-truth capture',
    qcHelp: 'Rapid reference capture. Assign to assets afterward for the twin package.',
    walkMeta: 'Ground-truth walk sequence — capture order for modeling and geospatial alignment.',
    exportBtn: 'Export Twin Package',
    reportBtn: 'Generate Report',
    suggestAreas: 'Suggest areas from GPS',
    promptOverall: '1. Overall / context (required)',
    promptTag: '2. Identifier / tag close-up (required)',
    promptDetail: '3. Detail / geometry close-up (required)',
    promptOther: '4. Additional / surrounding context',
    photoTypeLabel: 'Reference view type (required sequence)',
    navVisits: 'Sites',
    visitModalNew: 'New Collection',
    visitModalEdit: 'Edit Collection',
    visitTitleLabel: 'Collection / Site Title',
    overallNotes: 'Collection Notes',
    industryTemplate: 'Capture Template',
    saveVisit: 'Save Collection',
    editVisit: 'Edit Site',
    deleteVisit: 'Delete Site',
    areasHeading: 'Sectors / Zones',
    equipmentHeading: 'All Assets',
    assignHelp: 'Select an asset (or create new), then choose photos to assign.',
    clusterTitle: 'Suggested Sectors',
    clusterMeta: 'Grouped by GPS proximity for ground-truth zones. Rename and apply what you want.',
    photosHelp: 'All ground-truth reference photos stored on this device.',
    searchPh: 'Search sites, zones, tags, locations...',
    missingPhotos: (n) => n + ' missing photos',
    missingGps: (n) => n + ' missing GPS',
    missingGuided: (n) => n + ' missing required views',
    pdfKind: { full: 'Capture / Digital Twin', summary: 'Summary', exceptions: 'Gaps' },
    equipNoun: 'assets',
    itemsNoun: 'assets'
  }
};

function isDefense() { return productMode === 'defense'; }
function copy() { return COPY[productMode] || COPY.commercial; }

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}
function setPlaceholder(id, text) {
  const el = $(id);
  if (el) el.placeholder = text;
}
function setLabel(id, text, required) {
  const el = $(id);
  if (!el) return;
  el.innerHTML = required ? (escapeHtml(text) + ' <span class="required">*</span>') : escapeHtml(text);
}

function guidedTypes(photos) {
  return new Set((photos || []).map(p => p.promptType).filter(Boolean));
}
function nextMissingPromptType(photos, type) {
  const types = guidedTypes(photos);
  const shots = shotsFor(type || selectedEqType || 'other');
  for (const s of shots) {
    if (!types.has(s.id)) return s.id;
  }
  return shots.length ? shots[shots.length - 1].id : 'other';
}
function hasRequiredViews(eq) {
  const types = guidedTypes(eq.photos);
  if (isDefense()) return types.has('overall') && types.has('tag') && types.has('detail');
  const req = shotsFor(eq.eqType || 'other').filter(s => s.required);
  return req.every(s => types.has(s.id));
}

function equipmentReadiness(eq) {
  const photos = eq.photos || [];
  const types = guidedTypes(photos);
  const hasGps = eq.lat != null && eq.lng != null;
  const hasPhotos = photos.length > 0;
  if (productMode === 'defense') {
    let s = 0;
    if (hasGps) s += 40;
    if (hasPhotos) s += 10;
    if (types.has('overall')) s += 16;
    if (types.has('tag')) s += 17;
    if (types.has('detail')) s += 17;
    return s;
  }
  const shots = shotsFor(eq.eqType || selectedEqType || 'other');
  const required = shots.filter(s => s.required);
  const extra = shots.filter(s => !s.required);
  let s = 0;
  if (hasGps) s += 20;
  if (hasPhotos) s += 10;
  const reqEach = required.length ? 50 / required.length : 0;
  required.forEach(sh => { if (types.has(sh.id)) s += reqEach; });
  const extraEach = extra.length ? 20 / extra.length : 0;
  extra.forEach(sh => { if (types.has(sh.id)) s += extraEach; });
  return Math.round(Math.min(100, s));
}
function visitReadinessScore(items) {
  if (!items.length) return 0;
  const sum = items.reduce((acc, eq) => acc + equipmentReadiness(eq), 0);
  return Math.round(sum / items.length);
}

function applyProductMode(mode, opts) {
  const silent = opts && opts.silent;
  productMode = mode === 'defense' ? 'defense' : 'commercial';
  try { localStorage.setItem('fieldvault_product_mode', productMode); } catch (e) {}
  document.body.classList.toggle('defense-mode', productMode === 'defense');
  document.body.classList.toggle('commercial-mode', productMode === 'commercial');
  const c = copy();

  setText('mode-pill-label', c.pill);
  $('btn-mode-commercial')?.classList.toggle('active', productMode === 'commercial');
  $('btn-mode-defense')?.classList.toggle('active', productMode === 'defense');
  const defBtn = $('more-defense');
  if (defBtn) defBtn.textContent = productMode === 'defense' ? 'Back to oil & gas' : 'Defense mode (advanced)';
  setText('mode-banner-text', c.banner);
  setText('btn-new-visit', c.newVisitBtn);
  setText('visits-empty-title', c.emptyTitle);
  setText('visits-empty-body', c.emptyBody);
  setText('btn-empty-new', c.emptyCta);
  setText('completeness-title-text', c.completenessTitle);
  setText('btn-ready-check', c.readyBtn);
  setText('ready-check-title', c.readyHeader);
  setText('ready-check-meta', c.readyMeta);
  setText('btn-ready-done', c.readyBack);
  setText('photo-prompts-title', c.photoPromptsTitle);
  const help = $('photo-prompts-help');
  if (help) {
    help.textContent = c.photoPromptHelp;
    help.classList.toggle('hidden', !c.photoPromptHelp);
  }
  setText('eq-followup-text', c.followup);
  setPlaceholder('eq-notes', c.eqNotesPh);
  setPlaceholder('visit-notes', c.visitNotesPh);
  setPlaceholder('visit-title', c.visitTitlePh);
  setPlaceholder('search-input', c.searchPh);
  setText('qc-help', c.qcHelp);
  setText('walk-seq-meta', c.walkMeta);
  setText('btn-export-package', c.exportBtn);
  setText('btn-generate-pdf', c.reportBtn);
  setText('btn-suggest-areas', c.suggestAreas);
  setText('photo-type-label', c.photoTypeLabel);
  setText('nav-visits-label', c.navVisits);
  setLabel('visit-title-label', c.visitTitleLabel, true);
  setText('visit-notes-label', c.overallNotes);
  setText('visit-template-label', c.industryTemplate);
  setText('btn-save-visit', c.saveVisit);
  setText('btn-edit-visit', c.editVisit);
  setText('btn-delete-visit', c.deleteVisit);
  setText('areas-heading', c.areasHeading);
  setText('equipment-heading', c.equipmentHeading);
  setText('assign-help', c.assignHelp);
  setText('cluster-title', c.clusterTitle);
  setText('cluster-meta', c.clusterMeta);
  setText('global-photos-help', c.photosHelp);
  setText('optional-details-summary', isDefense() ? 'More details (optional)' : 'Condition, P&ID, nameplate (optional)');
  renderCoach();
  renderEqTypeChips();
  if ($('shot-guide-list')) renderShotGuide(window.__fvCurrentPhotos || []);

  if (!silent) {
    showToast(productMode === 'defense'
      ? 'Defense mode — modeling-ready capture'
      : 'Oil & gas field notes');
  }

  if (currentView === 'view-visits' || currentView === 'visits') renderVisitsList();
  else if ((currentView === 'view-visit-detail') && currentVisitId) loadVisitDetail(currentVisitId);
}

function setProductMode(mode) {
  applyProductMode(mode);
}
function toggleProductMode() {
  applyProductMode(isDefense() ? 'commercial' : 'defense');
}

let selectedEqType = 'other';
let pendingShotType = null;
let eqTypeFilter = 'all';
let mediaRecorder = null;
let audioChunks = [];
let voiceStream = null;
let voiceTargetId = null;
let lastFix = null;
let gpsWatchId = null;

function persistSession() {
  try {
    sessionStorage.setItem('fv_session', JSON.stringify({
      visitId: currentVisitId,
      areaId: currentAreaId,
      eqId: currentEquipmentId,
      shot: pendingShotType,
      eqType: selectedEqType,
      view: currentView
    }));
  } catch (e) {}
}
function restoreSession() {
  try {
    const s = JSON.parse(sessionStorage.getItem('fv_session') || 'null');
    if (!s) return s;
    if (s.visitId && !currentVisitId) currentVisitId = s.visitId;
    if (s.areaId && !currentAreaId) currentAreaId = s.areaId;
    if (s.eqId && !currentEquipmentId) currentEquipmentId = s.eqId;
    if (s.shot && !pendingShotType) pendingShotType = s.shot;
    if (s.eqType) selectedEqType = s.eqType;
    return s;
  } catch (e) { return null; }
}
function setPendingShot(id) {
  pendingShotType = id || null;
  persistSession();
}

function armCameraCapture(shotId) {
  setPendingShot(shotId || null);
  persistSession();
  const cam = $('photo-input-cam') || $('photo-input');
  if (!cam) { showToast('Camera input missing'); return; }
  try { cam.value = ''; } catch (e) {}
  cam.click();
}

function shot(id, label, required, tip) {
  return { id, label, required: !!required, tip: tip || '' };
}
const OG_TYPES = {
  pump: { label: 'Pump', example: 'P-101 or Charge pump', shots: [
    shot('overall', 'Whole pump from a few steps back', true, 'Include the motor and nearby piping so the office can place it.'),
    shot('tag', 'Nameplate or painted tag', true, 'Fill the frame so letters and numbers are readable.'),
    shot('coupling', 'Coupling / connection to the motor', false, 'The guard and the pump–motor connection.'),
    shot('seal', 'Seal area (look for leaks)', false, 'Wetness, crystals, or staining around the seal.'),
    shot('suction', 'Suction pipe and valve', false, 'The line feeding the pump, including the suction valve.'),
    shot('discharge', 'Discharge pipe and valve', false, 'The line leaving the pump, including the discharge valve.'),
    shot('base', 'Baseplate, bolts, foundation', false, 'Bolts, grout, and whether it sits true.'),
    shot('other', 'Anything else useful', false, 'Leaks, missing tags, access, damage.')
  ]},
  compressor: { label: 'Compressor', example: 'K-201 or Gas compressor', shots: [
    shot('overall', 'Whole compressor skid', true, 'Stand back so the skid, driver, and piping are in frame.'),
    shot('tag', 'Nameplate or tag', true, 'Fill the frame with the nameplate.'),
    shot('coupling', 'Driver / coupling', false, 'Motor or engine connection to the compressor.'),
    shot('coolers', 'Coolers or lube oil', false, 'Coolers, lube oil skid, or fans.'),
    shot('piping', 'Suction and discharge piping', false, 'Both process lines and their valves.'),
    shot('base', 'Skid, anchors, foundation', false, 'Anchors, grout, and housekeeping.'),
    shot('other', 'Anything else useful', false, 'Noise, leaks, missing guards.')
  ]},
  motor: { label: 'Motor', example: 'M-101 or Pump motor', shots: [
    shot('overall', 'Motor and driven equipment', true, 'Show how the motor sits with the pump or fan.'),
    shot('tag', 'Nameplate', true, 'HP, RPM, and voltage should be readable.'),
    shot('coupling', 'Coupling / shaft', false, 'Guard on, coupling or shaft visible.'),
    shot('junction', 'Junction box / cables', false, 'Box cover, glands, and cable condition.'),
    shot('base', 'Base and bolts', false, 'Hold-down bolts and pad.'),
    shot('other', 'Anything else useful', false, 'Heat damage, missing hardware.')
  ]},
  vessel: { label: 'Vessel / drum', example: 'V-301 or Scrubber', shots: [
    shot('overall', 'Whole vessel in the plot', true, 'Include supports and nearby equipment for context.'),
    shot('tag', 'Nameplate or stamp', true, 'Nameplate, stencil, or stamped tag.'),
    shot('nozzles', 'Nozzles and attachments', false, 'Manways, nozzles, and instruments on the shell.'),
    shot('relief', 'Relief valve or vent', false, 'PSV, rupture disc, or vent on the vessel.'),
    shot('supports', 'Supports / saddle / foundation', false, 'Saddles, legs, and grout.'),
    shot('other', 'Anything else useful', false, 'Corrosion, insulation, access.')
  ]},
  tank: { label: 'Tank', example: 'TK-101 or Produced water tank', shots: [
    shot('overall', 'Whole tank from the plot', true, 'Include stairs, dike, and neighboring tanks if you can.'),
    shot('tag', 'Nameplate, stencil, or sign', true, 'Tank number should be readable.'),
    shot('nozzles', 'Nozzles, mixers, gauges', false, 'Shell nozzles, mixers, and level gauges.'),
    shot('dike', 'Dike, stairs, or containment', false, 'Containment, stairs, and walkways.'),
    shot('foundation', 'Foundation / ringwall', false, 'Ringwall, settlement, or leaks at the base.'),
    shot('other', 'Anything else useful', false, 'Coating, roof, vents.')
  ]},
  separator: { label: 'Separator', example: 'V-110 or 3-phase separator', shots: [
    shot('overall', 'Whole separator skid', true, 'Vessel, piping, and instruments in one frame.'),
    shot('tag', 'Nameplate or tag', true, 'Fill the frame with the nameplate.'),
    shot('level', 'Level glasses / instruments', false, 'Glasses, bridles, and level transmitters.'),
    shot('nozzles', 'Inlets, outlets, dump lines', false, 'Process in and out, including dump valves.'),
    shot('relief', 'Relief or vent', false, 'PSV, vent, or flare connection.'),
    shot('other', 'Anything else useful', false, 'Skid, drains, access.')
  ]},
  exchanger: { label: 'Exchanger', example: 'E-401 or Crude exchanger', shots: [
    shot('overall', 'Whole exchanger', true, 'Shell, channel, and nearby piping.'),
    shot('tag', 'Nameplate', true, 'Nameplate should be readable.'),
    shot('heads', 'Heads, channel, or flanges', false, 'Channel head, cover, or floating head.'),
    shot('piping', 'Process piping in and out', false, 'Both sides of the exchanger.'),
    shot('supports', 'Supports / foundation', false, 'Saddles and anchors.'),
    shot('other', 'Anything else useful', false, 'Leaks at flanges, insulation.')
  ]},
  heater: { label: 'Heater / furnace', example: 'H-101 or Crude heater', shots: [
    shot('overall', 'Heater in the plot', true, 'Box or cabin, stack, and nearby piping.'),
    shot('tag', 'Nameplate or stencil', true, 'Heater number should be readable.'),
    shot('burners', 'Burner front / firebox access', false, 'Only from a safe, permitted standing point.'),
    shot('stack', 'Stack and dampers', false, 'Stack, platforms, and visible dampers.'),
    shot('piping', 'Process piping and valves', false, 'Passes in and out of the heater.'),
    shot('other', 'Anything else useful', false, 'Skin TIs, peepholes, access.')
  ]},
  flare: { label: 'Flare', example: 'FL-1 or HP flare', shots: [
    shot('overall', 'Flare stack from a safe distance', true, 'Do not enter restricted areas. Shoot from the road or plot edge.'),
    shot('tag', 'K.O. drum or stack ID', true, 'Drum nameplate or stack stencil.'),
    shot('kodrum', 'Knockout drum and pumps', false, 'Drum, pumps, and liquid seal if visible.'),
    shot('piping', 'Flare header into the drum', false, 'Header, valves, and supports.'),
    shot('other', 'Anything else useful', false, 'Fence, lights, ignition skid.')
  ]},
  valve: { label: 'Valve', example: 'HV-210 or Isolation valve', shots: [
    shot('overall', 'Valve in the line', true, 'Show the valve in the pipe run so size and type are clear.'),
    shot('tag', 'Tag or nameplate', true, 'Tag plate or painted number.'),
    shot('actuator', 'Handwheel, actuator, or operator', false, 'Operator, gearbox, or actuator.'),
    shot('flanges', 'Flanges, packing, leak points', false, 'Bonnet, packing, and flange faces.'),
    shot('other', 'Anything else useful', false, 'Missing handle, chain, or lock.')
  ]},
  psv: { label: 'Relief valve', example: 'PSV-501', shots: [
    shot('overall', 'Installed relief valve', true, 'Show how it sits on the vessel or line.'),
    shot('tag', 'Nameplate (set pressure)', true, 'Set pressure and tag must be readable.'),
    shot('inlet', 'Inlet piping', false, 'The pipe from the protected equipment.'),
    shot('outlet', 'Discharge piping / direction', false, 'Where it relieves — flare, atmosphere, or tank.'),
    shot('other', 'Anything else useful', false, 'Car seal, isolation, drip pan.')
  ]},
  pipe: { label: 'Pipe / line', example: '8"-CS-101 or Rack line', shots: [
    shot('overall', 'The run in the rack or trench', true, 'Enough of the run to see routing and neighbors.'),
    shot('tag', 'Line number or stencil', true, 'Line number, spec, or painted ID.'),
    shot('support', 'Support, shoe, or guide', false, 'Shoes, springs, guides, or dummy legs.'),
    shot('flange', 'Flange, spec break, or fitting', false, 'Flanges, reducers, or spec breaks.'),
    shot('other', 'Anything else useful', false, 'Insulation, leaks, corrosion.')
  ]},
  wellhead: { label: 'Wellhead', example: 'Well 12 or Tree A-4', shots: [
    shot('overall', 'Tree and wellbay', true, 'From a safe standing point. Include the cellar if visible.'),
    shot('tag', 'Well ID or tree tag', true, 'Well number or tree tag.'),
    shot('tree', 'Valves on the tree', false, 'Master, wing, and swab valves.'),
    shot('piping', 'Flowline connection', false, 'Where production leaves the tree.'),
    shot('other', 'Anything else useful', false, 'Choke, gauges, leak stains.')
  ]},
  instrument: { label: 'Instrument', example: 'PT-101 or Level transmitter', shots: [
    shot('overall', 'How it is installed', true, 'Show the tap, tubing, and nearby pipe or vessel.'),
    shot('tag', 'Tag plate', true, 'Tag should be readable.'),
    shot('process', 'Process connection / tubing', false, 'Impulse lines, manifolds, or isolation.'),
    shot('wiring', 'Junction box or wiring', false, 'Cable, glands, and box.'),
    shot('other', 'Anything else useful', false, 'Sun shield, missing plugs.')
  ]},
  electrical: { label: 'Electrical', example: 'MCC-1 or Panel PP-2', shots: [
    shot('overall', 'Room, rack, or gear', true, 'Do not open live gear. Shoot from a safe standing point.'),
    shot('tag', 'Nameplate or panel ID', true, 'Panel or MCC ID should be readable.'),
    shot('interior', 'Interior / devices (if safe and allowed)', false, 'Only if the client allows and it is de-energized or behind a window.'),
    shot('cables', 'Cables and entry', false, 'Cable trays, glands, and entry.'),
    shot('other', 'Anything else useful', false, 'Labels, missing covers, heat.')
  ]},
  other: { label: 'Other', example: 'What you see', shots: [
    shot('overall', 'Wide / context shot', true, 'Stand back so the item and its neighbors are in frame.'),
    shot('tag', 'Nameplate or identifier', true, 'Anything that names it — tag, stencil, or sign.'),
    shot('detail', 'Close-up of the important part', false, 'The thing you would point at in the office.'),
    shot('other', 'Anything else useful', false, 'Condition, access, or nearby hazards.')
  ]}
};
const OG_TYPE_ORDER = ['pump','compressor','motor','vessel','tank','separator','exchanger','heater','flare','valve','psv','pipe','wellhead','instrument','electrical','other'];
const EXTRA_SHOTS = [
  shot('leak', 'Leak, stain, or wetness', false, 'Any dripping, crystals, or staining the office should see.'),
  shot('damage', 'Damage or missing parts', false, 'Dents, missing bolts, broken gauges, rust holes.'),
  shot('safety', 'Safety issue', false, 'Missing guard, blocked path, unlabeled energy, trip hazard.'),
  shot('access', 'How you got to it', false, 'Ladder, platform, crowding — helps plan the next visit.')
];
const OG_TEMPLATES = {
  walkdown: ['Pipe rack', 'Pump area', 'Vessels & exchangers', 'Tank farm', 'Utilities'],
  rotating: ['Pump alley', 'Compressor building', 'Lube oil'],
  tanks: ['Tank farm', 'Process plot', 'Exchanger bay'],
  piping: ['Main pipe rack', 'Battery limits', 'Underground'],
  electrical: ['Substation', 'MCC room', 'Field instruments'],
  tar: ['Unit plot', 'Pipe rack', 'Pumps', 'Exchangers', 'Relief & safety'],
  mechanical: ['Pipe rack', 'Pump area', 'Vessels & exchangers'],
  civil: ['Foundations', 'Structures', 'Buildings'],
  general: ['Site', 'Process area', 'Utilities'],
  twin: ['Scan path', 'Tie-in points', 'Control references']
};
const TEMPLATE_LABELS = {
  walkdown: 'Plant walkdown',
  rotating: 'Pumps & compressors',
  tanks: 'Tanks, vessels & exchangers',
  piping: 'Piping & pipe rack',
  electrical: 'Electrical & instruments',
  tar: 'Turnaround / shutdown',
  mechanical: 'Mechanical',
  civil: 'Civil / structural',
  general: 'General',
  twin: 'Reality capture'
};
function templateLabel(id) {
  return TEMPLATE_LABELS[id] || id || '';
}
function missingRequiredShots(eq) {
  const types = guidedTypes(eq && eq.photos);
  return shotsFor((eq && eq.eqType) || 'other').filter(s => s.required && !types.has(s.id));
}

function shotsFor(type) {
  const base = [...((OG_TYPES[type] || OG_TYPES.other).shots)];
  const ids = new Set(base.map(s => s.id));
  EXTRA_SHOTS.forEach(s => { if (!ids.has(s.id)) base.push(s); });
  return base;
}
function shotLabel(id, type) {
  const s = shotsFor(type || selectedEqType).find(x => x.id === id);
  if (s) return s.label;
  const fallback = { overall: 'Overall', tag: 'Nameplate', detail: 'Detail', other: 'Other' };
  return fallback[id] || id;
}
function renderEqTypeChips() {
  const wrap = $('eq-type-chips');
  const sel = $('eq-type-select');
  if (sel) {
    sel.innerHTML = OG_TYPE_ORDER.map(id =>
      `<option value="${id}" ${selectedEqType===id?'selected':''}>${escapeHtml(OG_TYPES[id].label)}</option>`
    ).join('');
  }
  if (!wrap) return;
  wrap.innerHTML = OG_TYPE_ORDER.map(id => {
    const t = OG_TYPES[id];
    return `<button type="button" class="chip ${selectedEqType===id?'active':''}" data-eqtype="${id}">${escapeHtml(t.label)}</button>`;
  }).join('');
  wrap.querySelectorAll('.chip[data-eqtype]').forEach(c => {
    c.addEventListener('click', () => setEqType(c.dataset.eqtype));
  });
}
function setEqType(type, opts) {
  selectedEqType = OG_TYPES[type] ? type : 'other';
  renderEqTypeChips();
  const meta = OG_TYPES[selectedEqType];
  const tag = $('eq-tag');
  if (tag) tag.placeholder = 'e.g. ' + meta.example;
  populatePhotoTypeSelect();
  renderShotGuide(window.__fvCurrentPhotos || []);
  if (!(opts && opts.silent)) {
    const n = shotsFor(selectedEqType).length;
    showToast(meta.label + ' — ' + n + ' photos. Start with a wide shot.');
  }
}
function populatePhotoTypeSelect() {
  const sel = $('photo-prompt-type');
  if (!sel) return;
  const shots = shotsFor(selectedEqType);
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Select —</option>' + shots.map(s =>
    `<option value="${s.id}">${escapeHtml(s.label)}</option>`
  ).join('');
  if (cur) sel.value = cur;
}
function renderShotGuide(photos) {
  window.__fvCurrentPhotos = photos || [];
  const list = $('shot-guide-list');
  if (!list) return;
  const shots = shotsFor(selectedEqType);
  const taken = guidedTypes(photos);
  const done = shots.filter(s => taken.has(s.id)).length;
  const req = shots.filter(s => s.required).length;
  const reqDone = shots.filter(s => s.required && taken.has(s.id)).length;
  const prog = $('shot-progress');
  if (prog) {
    prog.textContent = done + ' of ' + shots.length;
    prog.className = 'badge ' + (reqDone === 0 ? 'danger' : reqDone < req ? 'warn' : 'ok');
  }
  const nxt = shots.find(s => !taken.has(s.id));
  const banner = $('next-shot-banner');
  if (banner) {
    if (!photos || !shots.length) {
      banner.classList.add('hidden');
    } else if (nxt) {
      banner.classList.remove('hidden');
      banner.classList.remove('done');
      banner.innerHTML = '<strong>Next:</strong> ' + escapeHtml(nxt.label) + (nxt.required ? '' : ' <span class="shot-opt">(optional)</span>');
    } else {
      banner.classList.remove('hidden');
      banner.classList.add('done');
      banner.innerHTML = '<strong>Nice.</strong> Listed shots are in. Add extras if useful.';
    }
  }
  list.innerHTML = shots.map(s => {
    const ok = taken.has(s.id);
    const needed = s.required && !ok;
    const tip = (!ok && s.tip) ? `<div class="shot-tip">${escapeHtml(s.tip)}</div>` : '';
    const matches = (photos || []).filter(p => p.promptType === s.id);
    const thumb = matches.length
      ? `<button type="button" class="shot-thumb" data-photoid="${matches[0].id}"><img src="${matches[0].dataUrl}" alt="">${matches.length>1?`<span class="shot-count">${matches.length}</span>`:''}</button>`
      : `<span class="shot-thumb empty" aria-hidden="true"></span>`;
    return `<div class="shot-row ${ok?'done':''} ${needed?'needed':''}" data-shot="${s.id}">
      ${thumb}
      <div class="shot-copy"><div class="shot-label">${escapeHtml(s.label)}${s.required ? '' : ' <span class="shot-opt">optional</span>'}${needed ? ' <span class="shot-need">needed</span>' : ''}</div>${tip}</div>
      <button type="button" class="btn-sm ${ok ? 'btn-secondary' : 'btn-primary'} btn-shot-cam" data-shot="${s.id}">${ok ? 'Add' : 'Take'}</button>
    </div>`;
  }).join('');
  list.querySelectorAll('.btn-shot-cam').forEach(b => {
    b.addEventListener('click', (ev) => {
      ev.preventDefault();
      armCameraCapture(b.dataset.shot);
    });
  });
  list.querySelectorAll('.shot-thumb[data-photoid]').forEach(b => {
    b.addEventListener('click', () => {
      const id = b.dataset.photoid;
      const p = (photos || []).find(x => x.id === id);
      if (!p) return;
      currentPhotoId = id;
      openMarkup(p.dataUrl, p);
    });
  });
  renderStickyNext(photos);
}
function renderEqTypeFilter(items) {
  const wrap = $('eq-type-filter');
  if (!wrap) return;
  const counts = {};
  for (const e of items) {
    const t = e.eqType || 'other';
    counts[t] = (counts[t] || 0) + 1;
  }
  const used = OG_TYPE_ORDER.filter(id => counts[id]);
  if (!used.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = `<button type="button" class="chip ${eqTypeFilter==='all'?'active':''}" data-filter="all">All</button>` +
    used.map(id => `<button type="button" class="chip ${eqTypeFilter===id?'active':''}" data-filter="${id}">${escapeHtml(OG_TYPES[id].label)} ${counts[id]}</button>`).join('');
  wrap.querySelectorAll('.chip').forEach(c => {
    c.addEventListener('click', () => {
      eqTypeFilter = c.dataset.filter;
      if (currentVisitId) loadVisitDetail(currentVisitId);
    });
  });
}
function renderCoach() {
  const el = $('coach-card');
  if (!el) return;
  let dismissed = false;
  try { dismissed = localStorage.getItem('fieldvault_coach') === '1'; } catch (e) {}
  el.classList.toggle('hidden', dismissed || isDefense());
}

const KIND_CARDS = [
  { id: 'walkdown', title: 'Plant walkdown', sub: 'Best first visit. We set up common plant areas.' },
  { id: 'rotating', title: 'Pumps & compressors', sub: 'Rotating equipment, seals, couplings.' },
  { id: 'tanks', title: 'Tanks & vessels', sub: 'Tanks, drums, exchangers, separators.' },
  { id: 'piping', title: 'Pipe rack', sub: 'Lines, supports, valves on the rack.' },
  { id: 'electrical', title: 'Electrical', sub: 'MCC, panels, field instruments.' },
  { id: 'tar', title: 'Turnaround', sub: 'Shutdown walkdown and punch items.' }
];
function renderKindCards(selected) {
  const grid = $('visit-kind-grid');
  if (!grid) return;
  const sel = selected || $('visit-template')?.value || 'walkdown';
  grid.innerHTML = KIND_CARDS.map(k => `
    <button type="button" class="kind-card ${k.id===sel?'active':''}" data-kind="${k.id}">
      <span class="kind-title">${escapeHtml(k.title)}</span>
      <span class="kind-sub">${escapeHtml(k.sub)}</span>
    </button>
  `).join('');
  grid.querySelectorAll('.kind-card').forEach(b => {
    b.addEventListener('click', () => {
      if ($('visit-template')) $('visit-template').value = b.dataset.kind;
      renderKindCards(b.dataset.kind);
    });
  });
}

function renderStickyNext(photos) {
  const bar = $('sticky-next');
  if (!bar) return;
  const onEq = currentView === 'view-equipment-detail';
  if (!onEq || isDefense()) {
    bar.classList.add('hidden');
    document.body.classList.remove('has-sticky-next');
    return;
  }
  const shots = shotsFor(selectedEqType);
  const taken = guidedTypes(photos);
  const nxt = shots.find(s => s.required && !taken.has(s.id)) || shots.find(s => !taken.has(s.id));
  if (!nxt) {
    bar.classList.add('hidden');
    document.body.classList.remove('has-sticky-next');
    return;
  }
  bar.classList.remove('hidden');
  document.body.classList.add('has-sticky-next');
  const copyEl = $('sticky-next-copy');
  if (copyEl) copyEl.innerHTML = '<strong>Next photo</strong> ' + escapeHtml(nxt.label);
  const take = $('btn-sticky-take');
  if (take) take.onclick = () => {
    armCameraCapture(nxt.id);
  };
}

async function renderCrumbs() {
  const bar = $('crumb-bar');
  if (!bar) return;
  const deep = currentView && currentView !== 'view-visits' && currentView !== 'view-global-photos' && currentView !== 'view-global-map';
  if (!deep || !currentVisitId) {
    bar.classList.add('hidden');
    bar.innerHTML = '';
    document.body.classList.remove('has-crumbs');
    return;
  }
  const parts = [{ label: 'Visits', view: 'visits' }];
  try {
    const visit = await dbGet(STORE_VISITS, currentVisitId);
    if (visit) parts.push({ label: visit.title || 'Visit', view: 'visit' });
  } catch (e) {}
  if (currentAreaId && (currentView === 'view-area-detail' || currentView === 'view-equipment-detail')) {
    try {
      const area = await dbGet(STORE_AREAS, currentAreaId);
      if (area) parts.push({ label: area.name, view: 'area' });
    } catch (e) {}
  }
  if (currentView === 'view-equipment-detail') {
    const tag = $('eq-tag')?.value || $('header-title')?.textContent || 'Equipment';
    parts.push({ label: tag, view: 'eq' });
  } else if (currentView === 'view-map') parts.push({ label: 'Map', view: 'map' });
  else if (currentView === 'view-photos-library') parts.push({ label: 'Photos', view: 'photos' });
  else if (currentView === 'view-quick-capture') parts.push({ label: 'Snap photos', view: 'qc' });
  else if (currentView === 'view-ready-check') parts.push({ label: "What's missing", view: 'ready' });
  else if (currentView === 'view-walk-seq') parts.push({ label: 'Walk path', view: 'walk' });
  bar.classList.remove('hidden');
  document.body.classList.add('has-crumbs');
  bar.innerHTML = parts.map((p, i) => {
    const last = i === parts.length - 1;
    if (last) return `<span class="crumb current">${escapeHtml(p.label)}</span>`;
    return `<button type="button" class="crumb-link" data-crumb="${p.view}">${escapeHtml(p.label)}</button><span class="crumb-sep">/</span>`;
  }).join('');
  bar.querySelectorAll('.crumb-link').forEach(b => {
    b.addEventListener('click', () => {
      const v = b.dataset.crumb;
      if (v === 'visits') showView('view-visits');
      else if (v === 'visit' && currentVisitId) { showView('view-visit-detail'); loadVisitDetail(currentVisitId); }
      else if (v === 'area' && currentAreaId) { showView('view-area-detail'); loadAreaDetail(currentAreaId); }
    });
  });
}

async function renderEqPager() {
  const bar = $('eq-pager');
  if (!bar) return;
  if (currentView !== 'view-equipment-detail' || !currentVisitId || !currentEquipmentId) {
    bar.classList.add('hidden');
    return;
  }
  const items = await dbGetByIndex(STORE_EQUIPMENT, 'visitId', currentVisitId);
  items.sort((a,b) => (a.tag||'').localeCompare(b.tag||''));
  const idx = items.findIndex(e => e.id === currentEquipmentId);
  if (items.length < 2 || idx < 0) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  const lab = $('eq-pager-label');
  if (lab) lab.textContent = (idx + 1) + ' of ' + items.length;
  const prev = $('btn-eq-prev');
  const next = $('btn-eq-next');
  if (prev) {
    prev.disabled = idx <= 0;
    prev.onclick = () => {
      if (idx > 0) {
        currentEquipmentId = items[idx - 1].id;
        currentAreaId = items[idx - 1].areaId || null;
        showView('view-equipment-detail');
        loadEquipmentDetail(currentEquipmentId);
      }
    };
  }
  if (next) {
    next.disabled = idx >= items.length - 1;
    next.onclick = () => {
      if (idx < items.length - 1) {
        currentEquipmentId = items[idx + 1].id;
        currentAreaId = items[idx + 1].areaId || null;
        showView('view-equipment-detail');
        loadEquipmentDetail(currentEquipmentId);
      }
    };
  }
}

function setMoreOpen(open) {
  $('more-sheet')?.classList.toggle('hidden', !open);
}

async function ensureEquipmentName() {
  const tag = $('eq-tag');
  if (tag && tag.value.trim()) return tag.value.trim();
  const type = selectedEqType || 'other';
  const items = currentVisitId ? await dbGetByIndex(STORE_EQUIPMENT, 'visitId', currentVisitId) : [];
  const others = items.filter(e => e.id !== currentEquipmentId && (e.eqType || 'other') === type).length;
  const name = ((OG_TYPES[type] || OG_TYPES.other).label) + ' ' + (others + 1);
  if (tag) tag.value = name;
  return name;
}
async function seedTemplateAreas(visit) {
  const names = OG_TEMPLATES[visit.template];
  if (!names || !names.length) return;
  const existing = await dbGetByIndex(STORE_AREAS, 'visitId', visit.id);
  if (existing.length) return;
  const now = Date.now();
  for (const name of names) {
    await dbPut(STORE_AREAS, {
      id: uuid(), visitId: visit.id, name,
      notes: 'Suggested for this visit type — rename or delete anytime',
      createdAt: now, updatedAt: now
    });
  }
}


function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2);
}
function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
function showToast(msg, duration = 2200) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), duration);
}
function $(id) { return document.getElementById(id); }
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(STORE_VISITS)) {
        const vs = database.createObjectStore(STORE_VISITS, { keyPath: 'id' });
        vs.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!database.objectStoreNames.contains(STORE_AREAS)) {
        const as = database.createObjectStore(STORE_AREAS, { keyPath: 'id' });
        as.createIndex('visitId', 'visitId', { unique: false });
      }
      if (!database.objectStoreNames.contains(STORE_EQUIPMENT)) {
        const es = database.createObjectStore(STORE_EQUIPMENT, { keyPath: 'id' });
        es.createIndex('visitId', 'visitId', { unique: false });
        es.createIndex('areaId', 'areaId', { unique: false });
      }
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

function dbPut(store, data) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(data);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
function dbGet(store, id) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(id);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
function dbGetAll(store) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  });
}
function dbDelete(store, id) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
function dbGetByIndex(store, indexName, value) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).index(indexName).getAll(value);
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  });
}

function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $(viewId).classList.add('active');
  currentView = viewId;
  const backBtn = $('btn-back');
  const newBtn = $('btn-new-visit');
  const searchBtn = $('btn-search');

  // Bottom nav: hide only on markup
  const hideNav = ['view-markup'];
  document.body.classList.toggle('hide-bottom-nav', hideNav.includes(viewId));
  if (viewId !== 'view-equipment-detail') {
    document.body.classList.remove('has-sticky-next');
    $('sticky-next')?.classList.add('hidden');
  }

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (viewId === 'view-visits') $('nav-visits')?.classList.add('active');
  else if (viewId === 'view-global-photos') $('nav-photos')?.classList.add('active');
  else if (viewId === 'view-global-map') $('nav-map')?.classList.add('active');
  else if (currentVisitId) $('nav-site')?.classList.add('active');

  const siteNav = $('nav-site');
  if (siteNav) siteNav.disabled = !currentVisitId;

  if (viewId === 'view-visits') {
    backBtn.classList.add('hidden');
    newBtn.classList.remove('hidden');
    searchBtn.classList.remove('hidden');
    $('header-title').textContent = 'FieldVault';
    renderVisitsList();
  } else if (viewId === 'view-global-photos') {
    backBtn.classList.add('hidden');
    newBtn.classList.add('hidden');
    searchBtn.classList.add('hidden');
    $('header-title').textContent = 'Photos';
    openGlobalPhotos();
  } else if (viewId === 'view-global-map') {
    backBtn.classList.add('hidden');
    newBtn.classList.add('hidden');
    searchBtn.classList.add('hidden');
    $('header-title').textContent = 'Map';
    openGlobalMap();
  } else {
    backBtn.classList.remove('hidden');
    newBtn.classList.add('hidden');
    searchBtn.classList.add('hidden');
  }
  renderCrumbs();
  persistSession();
}

function goBack() {
  if (currentView === 'view-markup') {
    showView('view-equipment-detail');
    loadEquipmentDetail(currentEquipmentId);
  } else if (currentView === 'view-assign-photos') {
    showView('view-quick-capture');
  } else if (currentView === 'view-quick-capture' || currentView === 'view-ready-check' || currentView === 'view-photos-library' || currentView === 'view-map' || currentView === 'view-walk-seq' || currentView === 'view-cluster-review') {
    showView('view-visit-detail');
    loadVisitDetail(currentVisitId);
  } else if (currentView === 'view-equipment-detail') {
    if (currentAreaId) {
      showView('view-area-detail');
      loadAreaDetail(currentAreaId);
    } else {
      showView('view-visit-detail');
      loadVisitDetail(currentVisitId);
    }
  } else if (currentView === 'view-area-detail') {
    showView('view-visit-detail');
    loadVisitDetail(currentVisitId);
  } else if (currentView === 'view-visit-detail') {
    showView('view-visits');
  }
}

function initSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  try {
    recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';
    recognition.maxAlternatives = 1;
    recognition.onresult = (e) => {
      let finalText = '';
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      const el = currentVoiceTarget ? $(currentVoiceTarget) : (voiceTargetId ? $(voiceTargetId) : null);
      if (!el) return;
      if (!el.dataset.voiceBase) el.dataset.voiceBase = el.value || '';
      const base = el.dataset.voiceBase || '';
      const extra = (finalText || interim).trim();
      el.value = (base ? base.replace(/\s+$/, '') + (extra ? ' ' : '') : '') + extra;
      if (finalText) el.dataset.voiceBase = el.value;
    };
    recognition.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      console.warn('Speech error', e.error);
    };
    recognition.onend = () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        try { recognition.start(); } catch (err) {}
      }
    };
  } catch (e) {
    recognition = null;
  }
}

async function startVoice(targetId, btn) {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    stopVoiceRecording();
    return;
  }
  voiceTargetId = targetId;
  currentVoiceTarget = targetId;
  const el = $(targetId);
  if (el) delete el.dataset.voiceBase;
  btn?.classList.add('listening');

  let gotMic = false;
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      voiceStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      gotMic = true;
    } catch (e) {
      gotMic = false;
    }
  }

  if (gotMic && typeof MediaRecorder !== 'undefined') {
    audioChunks = [];
    const types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/aac'];
    const mime = types.find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t));
    try {
      mediaRecorder = mime ? new MediaRecorder(voiceStream, { mimeType: mime }) : new MediaRecorder(voiceStream);
      mediaRecorder.ondataavailable = (ev) => { if (ev.data && ev.data.size) audioChunks.push(ev.data); };
      mediaRecorder.onstop = () => { saveVoiceRecording(targetId); };
      mediaRecorder.start();
      showToast('Recording — tap the mic to stop');
    } catch (e) {
      mediaRecorder = null;
    }
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    if (!recognition) initSpeech();
    try {
      recognition.start();
      if (!mediaRecorder) showToast('Listening — tap mic to stop');
    } catch (e) {
      try {
        recognition.stop();
        setTimeout(() => { try { recognition.start(); } catch (e2) {} }, 250);
      } catch (e3) {}
    }
  }

  if (!gotMic && !SR) {
    btn?.classList.remove('listening');
    showToast('Microphone not available. Type the note, or allow mic access.');
  }
}

function stopVoiceRecording() {
  try { if (recognition) recognition.stop(); } catch (e) {}
  try { if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop(); } catch (e) {}
  document.querySelectorAll('.btn-voice').forEach(b => b.classList.remove('listening'));
}

function stopVoice() {
  stopVoiceRecording();
  currentVoiceTarget = null;
}

async function saveVoiceRecording(targetId) {
  const chunks = audioChunks.slice();
  audioChunks = [];
  try { voiceStream && voiceStream.getTracks().forEach(t => t.stop()); } catch (e) {}
  voiceStream = null;
  mediaRecorder = null;
  document.querySelectorAll('.btn-voice').forEach(b => b.classList.remove('listening'));

  const el = $(targetId);
  if (el && el.dataset.voiceBase) delete el.dataset.voiceBase;

  if (targetId === 'eq-notes' && currentEquipmentId && chunks.length) {
    try {
      const blob = new Blob(chunks, { type: chunks[0].type || 'audio/webm' });
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(blob);
      });
      const eq = await dbGet(STORE_EQUIPMENT, currentEquipmentId);
      if (eq) {
        eq.voiceNotes = eq.voiceNotes || [];
        eq.voiceNotes.push({ id: uuid(), dataUrl, createdAt: Date.now(), mime: blob.type });
        eq.updatedAt = Date.now();
        if (el) eq.notes = el.value.trim();
        await dbPut(STORE_EQUIPMENT, eq);
        renderVoiceNotes(eq.voiceNotes);
      }
    } catch (e) {
      console.warn(e);
    }
  }
  showToast('Voice note saved');
  persistSession();
}

function renderVoiceNotes(notes) {
  const list = $('eq-voice-list');
  if (!list) return;
  const items = notes || [];
  if (!items.length) { list.innerHTML = ''; return; }
  list.innerHTML = items.map((n, i) => `
    <div class="voice-clip" data-id="${n.id}">
      <span class="voice-clip-label">Voice ${i + 1}</span>
      <audio controls preload="metadata" src="${n.dataUrl}"></audio>
      <button type="button" class="btn-icon btn-voice-del" data-id="${n.id}" aria-label="Delete voice note">×</button>
    </div>
  `).join('');
  list.querySelectorAll('.btn-voice-del').forEach(b => {
    b.addEventListener('click', async () => {
      if (!currentEquipmentId) return;
      const eq = await dbGet(STORE_EQUIPMENT, currentEquipmentId);
      if (!eq) return;
      eq.voiceNotes = (eq.voiceNotes || []).filter(x => x.id !== b.dataset.id);
      await dbPut(STORE_EQUIPMENT, eq);
      renderVoiceNotes(eq.voiceNotes);
    });
  });
}

function toggleHighVis() {
  highVis = !highVis;
  document.body.classList.toggle('highvis', highVis);
  showToast(highVis ? 'High visibility on' : 'High visibility off');
}

async function renderVisitsList(filter = '') {
  const visits = await dbGetAll(STORE_VISITS);
  const equipment = await dbGetAll(STORE_EQUIPMENT);
  const areas = await dbGetAll(STORE_AREAS);
  visits.sort((a,b) => (b.updatedAt||0) - (a.updatedAt||0));

  const listEl = $('visits-list');
  const emptyEl = $('visits-empty');
  let filtered = visits;
  if (filter) {
    const q = filter.toLowerCase();
    filtered = visits.filter(v => {
      const eqText = equipment.filter(e => e.visitId === v.id).map(e => (e.tag||'') + ' ' + (e.locationDesc||'')).join(' ').toLowerCase();
      const areaText = areas.filter(a => a.visitId === v.id).map(a => a.name||'').join(' ').toLowerCase();
      return (v.title||'').toLowerCase().includes(q) || (v.client||'').toLowerCase().includes(q) || (v.facility||'').toLowerCase().includes(q) || eqText.includes(q) || areaText.includes(q);
    });
  }

  if (filtered.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  listEl.innerHTML = filtered.map(v => {
    const items = equipment.filter(e => e.visitId === v.id);
    const score = visitReadinessScore(items);
    const noun = copy().itemsNoun;
    return `<div class="card" data-id="${v.id}">
      <div class="card-title">${escapeHtml(v.title||'Untitled')}</div>
      <div class="card-meta">
        <span>${formatDate(v.date)}</span>
        ${v.client ? `<span>${escapeHtml(v.client)}</span>` : ''}
        ${v.facility ? `<span>${escapeHtml(v.facility)}</span>` : ''}
        <span>${items.length} ${noun}</span>
        <span class="badge ${score>=80?'ok':score>=40?'warn':'danger'}">${score}%</span>
      </div>
    </div>`;
  }).join('');
  listEl.querySelectorAll('.card').forEach(c => {
    c.addEventListener('click', () => {
      currentVisitId = c.dataset.id;
      currentAreaId = null;
      showView('view-visit-detail');
      loadVisitDetail(currentVisitId);
    });
  });
}

function openVisitModal(edit=false) {
  $('modal-visit-title').textContent = edit ? copy().visitModalEdit : copy().visitModalNew;
  if (!edit) {
    $('visit-title').value = '';
    $('visit-client').value = '';
    if ($('visit-facility')) $('visit-facility').value = '';
    $('visit-date').value = new Date().toISOString().slice(0,10);
    $('visit-notes').value = '';
    $('visit-template').value = 'walkdown';
    currentVisitId = null;
  }
  renderKindCards($('visit-template')?.value || 'walkdown');
  $('modal-visit').classList.remove('hidden');
}

async function saveVisit() {
  const title = $('visit-title').value.trim();
  if (!title) { showToast('Title required'); return; }
  const now = Date.now();
  const creating = !currentVisitId;
  let visit;
  if (!creating) {
    visit = await dbGet(STORE_VISITS, currentVisitId);
    if (!visit) return;
    visit.title = title;
    visit.client = $('visit-client').value.trim();
    visit.facility = $('visit-facility') ? $('visit-facility').value.trim() : (visit.facility || '');
    visit.date = $('visit-date').value;
    visit.overallNotes = $('visit-notes').value.trim();
    visit.template = $('visit-template').value;
    visit.updatedAt = now;
  } else {
    visit = {
      id: uuid(), title,
      client: $('visit-client').value.trim(),
      facility: $('visit-facility') ? $('visit-facility').value.trim() : '',
      date: $('visit-date').value || new Date().toISOString().slice(0,10),
      overallNotes: $('visit-notes').value.trim(),
      template: $('visit-template').value,
      createdAt: now, updatedAt: now
    };
    currentVisitId = visit.id;
  }
  await dbPut(STORE_VISITS, visit);
  if (creating) await seedTemplateAreas(visit);
  $('modal-visit').classList.add('hidden');
  showToast(creating ? 'Visit saved. Suggested plant areas are listed — add equipment as you walk.' : 'Visit saved');
  showView('view-visit-detail');
  loadVisitDetail(currentVisitId);
}

async function loadVisitDetail(id) {
  const visit = await dbGet(STORE_VISITS, id);
  if (!visit) { showView('view-visits'); return; }
  currentVisitId = id;
  startGpsWatch();
  $('header-title').textContent = visit.title || 'Visit';
  $('visit-detail-header').innerHTML = `
    <h2>${escapeHtml(visit.title)}</h2>
    <div class="meta">${formatDate(visit.date)}${visit.client ? ' · ' + escapeHtml(visit.client) : ''}${visit.facility ? ' · ' + escapeHtml(visit.facility) : ''}${visit.template ? ' · ' + escapeHtml(templateLabel(visit.template)) : ''}</div>
    ${visit.overallNotes ? `<p style="margin-top:10px;font-size:0.95rem">${escapeHtml(visit.overallNotes)}</p>` : ''}
  `;

  const areas = await dbGetByIndex(STORE_AREAS, 'visitId', id);
  const equipment = await dbGetByIndex(STORE_EQUIPMENT, 'visitId', id);
  areas.sort((a,b) => (a.name||'').localeCompare(b.name||''));
  equipment.sort((a,b) => (a.tag||'').localeCompare(b.tag||''));

  renderCompleteness(equipment);

  const areasList = $('areas-list');
  if (areas.length === 0) {
    areasList.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;padding:8px 0">No areas yet. Use + Area, or we can suggest groups from GPS after you pin equipment.</p>';
  } else {
    areasList.innerHTML = areas.map(a => {
      const count = equipment.filter(e => e.areaId === a.id).length;
      return `<div class="card" data-id="${a.id}">
        <div class="card-title">${escapeHtml(a.name)}</div>
        <div class="card-meta"><span>${count} equipment</span></div>
      </div>`;
    }).join('');
    areasList.querySelectorAll('.card').forEach(c => {
      c.addEventListener('click', () => {
        currentAreaId = c.dataset.id;
        showView('view-area-detail');
        loadAreaDetail(currentAreaId);
      });
    });
  }

  renderEqTypeFilter(equipment);
  const shown = eqTypeFilter === 'all' ? equipment : equipment.filter(e => (e.eqType || 'other') === eqTypeFilter);
  const eqList = $('equipment-list');
  if (equipment.length === 0) {
    eqList.innerHTML = `<div class="next-step-card">
      <h3>Start with one piece of equipment</h3>
      <p>Walk up to a pump, tank, valve, or pipe. Give it a name — or just take a photo. Start with a wide shot, then the nameplate.</p>
      <button type="button" class="btn-primary" id="btn-empty-add-eq">Add equipment</button>
    </div>`;
    $('btn-empty-add-eq')?.addEventListener('click', () => openNewEquipment(false));
  } else if (!shown.length) {
    eqList.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;padding:8px 0">No equipment in this filter.</p>';
  } else {
    eqList.innerHTML = shown.map(eq => eqCardHtml(eq, areas)).join('');
    eqList.querySelectorAll('.card').forEach(c => {
      c.addEventListener('click', () => {
        currentEquipmentId = c.dataset.id;
        currentAreaId = null;
        showView('view-equipment-detail');
        loadEquipmentDetail(currentEquipmentId);
      });
    });
  }
}

function eqCardHtml(eq, areas) {
  const photoCount = (eq.photos||[]).length;
  const border = eq.needsFollowup ? 'warning-border' : (photoCount === 0 ? 'danger-border' : '');
  const areaName = eq.areaId && areas ? (areas.find(a => a.id === eq.areaId)||{}).name : '';
  const typeLabel = (OG_TYPES[eq.eqType] || {}).label;
  const miss = missingRequiredShots(eq);
  return `<div class="card ${border}" data-id="${eq.id}">
    <div class="card-title">
      <span class="tag-badge">${escapeHtml(eq.tag||'No Tag')}</span>
      ${typeLabel ? `<span class="badge">${escapeHtml(typeLabel)}</span>` : ''}
      ${eq.needsFollowup ? '<span class="followup-badge">Follow-up</span>' : ''}
      <span class="badge ${photoCount===0?'danger':miss.length?'warn':'ok'}">${photoCount} photo${photoCount!==1?'s':''}</span>
      ${eq.condition ? `<span class="badge">${eq.condition}</span>` : ''}
    </div>
    <div class="card-meta">
      ${areaName ? `<span>${escapeHtml(areaName)}</span>` : ''}
      ${eq.service ? `<span>${escapeHtml(eq.service)}</span>` : ''}
      ${miss.length ? `<span>Still needs: ${escapeHtml(miss.map(s => s.label).join(', '))}</span>` : ''}
      ${eq.locationDesc ? `<span>${escapeHtml(eq.locationDesc)}</span>` : ''}
      ${eq.lat!=null && eq.lng!=null ? `<span class="coords-display">${Number(eq.lat).toFixed(5)}, ${Number(eq.lng).toFixed(5)}</span>` : ''}
    </div>
  </div>`;
}

function renderCompleteness(items) {
  const card = $('completeness-card');
  if (!items.length) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');
  const c = copy();
  const withPhotos = items.filter(e => (e.photos||[]).length > 0).length;
  const withCoords = items.filter(e => e.lat!=null && e.lng!=null).length;
  const needsFollowup = items.filter(e => e.needsFollowup).length;
  const withGuided = items.filter(hasRequiredViews).length;
  const score = visitReadinessScore(items);
  $('completeness-score').textContent = score + '%';
  $('completeness-stats').innerHTML = `
    <span><strong>${items.length}</strong> ${isDefense() ? c.equipNoun : 'equipment'}</span>
    <span><strong>${withPhotos}</strong> with photos</span>
    <span><strong>${withCoords}</strong> with GPS</span>
    <span><strong>${withGuided}</strong> key shots done</span>
  `;
  const warnings = [];
  if (items.length - withPhotos > 0) warnings.push(c.missingPhotos(items.length - withPhotos));
  if (items.length - withGuided > 0) warnings.push(c.missingGuided(items.length - withGuided));
  if (needsFollowup) warnings.push(needsFollowup + (isDefense() ? ' flagged for more reference photos' : ' flagged for follow-up'));
  if (items.length - withCoords > 0) warnings.push(c.missingGps(items.length - withCoords));
  $('completeness-warnings').innerHTML = warnings.map(w => '<div>'+w+'</div>').join('');
}

async function openReadyCheck() {
  const items = await dbGetByIndex(STORE_EQUIPMENT, 'visitId', currentVisitId);
  showView('view-ready-check');
  $('header-title').textContent = isDefense() ? 'Processing Check' : "What's missing?";
  const list = $('ready-list');
  const c = copy();
  const hard = items.filter(e => {
    if (isDefense()) {
      return !(e.photos||[]).length || e.needsFollowup || e.lat==null || !hasRequiredViews(e);
    }
    return !(e.photos||[]).length || e.needsFollowup || missingRequiredShots(e).length > 0;
  });
  const gpsOnly = items.filter(e => !hard.includes(e) && e.lat==null);
  if (hard.length === 0) {
    const gpsNote = gpsOnly.length
      ? `<p>${gpsOnly.length} item${gpsOnly.length===1?'':'s'} have no map pin — optional, but useful if you want locations on the map.</p>`
      : '';
    list.innerHTML = `<div class="empty-state"><h2>${escapeHtml(c.readyAllGood)}</h2><p>${escapeHtml(c.readyAllGoodBody)}</p>${gpsNote}</div>`;
    return;
  }
  const cards = hard.map(eq => {
    const issues = [];
    const miss = missingRequiredShots(eq);
    if (!(eq.photos||[]).length) issues.push('No photos yet');
    else if (miss.length) issues.push('Still needs: ' + miss.map(s => s.label).join(', '));
    if (eq.needsFollowup) issues.push(isDefense() ? 'More reference photos needed' : 'Follow-up flagged');
    if (isDefense() && eq.lat==null) issues.push('No GPS');
    return `<div class="card danger-border" data-id="${eq.id}">
      <div class="card-title"><span class="tag-badge">${escapeHtml(eq.tag||'?')}</span></div>
      <div class="card-meta">${issues.join(' · ')}</div>
    </div>`;
  }).join('');
  list.innerHTML = cards;
  list.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      currentEquipmentId = card.dataset.id;
      showView('view-equipment-detail');
      loadEquipmentDetail(currentEquipmentId);
    });
  });
}

async function deleteVisit() {
  if (!confirm('Delete this visit and all areas, equipment & photos?')) return;
  const areas = await dbGetByIndex(STORE_AREAS, 'visitId', currentVisitId);
  const items = await dbGetByIndex(STORE_EQUIPMENT, 'visitId', currentVisitId);
  for (const a of areas) await dbDelete(STORE_AREAS, a.id);
  for (const e of items) await dbDelete(STORE_EQUIPMENT, e.id);
  await dbDelete(STORE_VISITS, currentVisitId);
  showToast('Visit deleted');
  showView('view-visits');
}

function openAreaModal(edit=false) {
  $('modal-area-title').textContent = edit ? 'Edit Area' : 'New Area';
  if (!edit) {
    $('area-name').value = '';
    $('area-notes').value = '';
    currentAreaId = null;
  }
  $('modal-area').classList.remove('hidden');
}

async function saveArea() {
  const name = $('area-name').value.trim();
  if (!name) { showToast('Name required'); return; }
  const now = Date.now();
  let area;
  if (currentAreaId) {
    area = await dbGet(STORE_AREAS, currentAreaId);
    if (!area) return;
    area.name = name;
    area.notes = $('area-notes').value.trim();
    area.updatedAt = now;
  } else {
    area = { id: uuid(), visitId: currentVisitId, name, notes: $('area-notes').value.trim(), createdAt: now, updatedAt: now };
    currentAreaId = area.id;
  }
  await dbPut(STORE_AREAS, area);
  $('modal-area').classList.add('hidden');
  showToast('Area saved');
  if (currentView === 'view-area-detail') loadAreaDetail(currentAreaId);
  else loadVisitDetail(currentVisitId);
}

async function loadAreaDetail(id) {
  const area = await dbGet(STORE_AREAS, id);
  if (!area) { goBack(); return; }
  currentAreaId = id;
  $('header-title').textContent = area.name;
  $('area-detail-header').innerHTML = `<h2>${escapeHtml(area.name)}</h2>${area.notes ? `<p class="meta">${escapeHtml(area.notes)}</p>` : ''}`;
  const equipment = await dbGetByIndex(STORE_EQUIPMENT, 'areaId', id);
  equipment.sort((a,b) => (a.tag||'').localeCompare(b.tag||''));
  const list = $('area-equipment-list');
  if (!equipment.length) {
    list.innerHTML = '<p style="color:var(--text-muted)">No equipment in this area yet.</p>';
  } else {
    list.innerHTML = equipment.map(eq => eqCardHtml(eq, null)).join('');
    list.querySelectorAll('.card').forEach(c => {
      c.addEventListener('click', () => {
        currentEquipmentId = c.dataset.id;
        showView('view-equipment-detail');
        loadEquipmentDetail(currentEquipmentId);
      });
    });
  }
}

async function deleteArea() {
  if (!confirm('Delete this area? Equipment will become unassigned.')) return;
  const items = await dbGetByIndex(STORE_EQUIPMENT, 'areaId', currentAreaId);
  for (const e of items) {
    e.areaId = null;
    await dbPut(STORE_EQUIPMENT, e);
  }
  await dbDelete(STORE_AREAS, currentAreaId);
  showToast('Area deleted');
  currentAreaId = null;
  showView('view-visit-detail');
  loadVisitDetail(currentVisitId);
}

async function openNewEquipment(fromArea=false) {
  currentEquipmentId = null;
  selectedCondition = '';
  selectedPriority = '';
  selectedEqType = 'other';
  window.__fvCurrentPhotos = [];
  showView('view-equipment-detail');
  $('header-title').textContent = 'New equipment';
  $('eq-tag').value = '';
  $('eq-location').value = '';
  $('eq-lat').value = '';
  $('eq-lng').value = '';
  if (lastFix && Date.now() - lastFix.at < 10 * 60 * 1000) applyFixToForm(lastFix);
  else updateGpsStatusUi();
  $('eq-notes').value = '';
  $('eq-recommendation').value = '';
  if ($('eq-service')) $('eq-service').value = '';
  if ($('eq-pid')) $('eq-pid').value = '';
  if ($('eq-line')) $('eq-line').value = '';
  if ($('eq-mfr')) $('eq-mfr').value = '';
  if ($('eq-model')) $('eq-model').value = '';
  if ($('eq-serial')) $('eq-serial').value = '';
  $('eq-needs-followup').checked = false;
  $('photos-grid').innerHTML = '';
  $('photo-count-badge').textContent = '0';
  document.querySelectorAll('#condition-chips .chip, #priority-chips .chip').forEach(c => c.classList.remove('active'));
  await populateAreaSelect(fromArea ? currentAreaId : null);
  $('btn-delete-equipment').classList.add('hidden');
  setEqType('other', { silent: true });
  renderEqPager();
  renderCrumbs();
}

async function populateAreaSelect(selectedId) {
  const areas = await dbGetByIndex(STORE_AREAS, 'visitId', currentVisitId);
  const sel = $('eq-area');
  sel.innerHTML = '<option value="">— No area —</option>' + areas.map(a => 
    `<option value="${a.id}" ${a.id===selectedId?'selected':''}>${escapeHtml(a.name)}</option>`
  ).join('');
}

async function loadEquipmentDetail(id) {
  const eq = await dbGet(STORE_EQUIPMENT, id);
  if (!eq) { goBack(); return; }
  currentEquipmentId = id;
  $('header-title').textContent = eq.tag || 'Equipment';
  $('eq-tag').value = eq.tag || '';
  $('eq-location').value = eq.locationDesc || '';
  $('eq-lat').value = eq.lat != null ? eq.lat : '';
  $('eq-lng').value = eq.lng != null ? eq.lng : '';
  if (eq.lat == null && lastFix && Date.now() - lastFix.at < 10 * 60 * 1000) applyFixToForm(lastFix);
  else updateGpsStatusUi();
  startGpsWatch();
  $('eq-notes').value = eq.notes || '';
  $('eq-recommendation').value = eq.recommendation || '';
  $('eq-needs-followup').checked = !!eq.needsFollowup;
  selectedCondition = eq.condition || '';
  selectedPriority = eq.priority || '';
  selectedEqType = eq.eqType || 'other';
  if ($('eq-service')) $('eq-service').value = eq.service || '';
  if ($('eq-pid')) $('eq-pid').value = eq.pid || '';
  if ($('eq-line')) $('eq-line').value = eq.lineNo || '';
  if ($('eq-mfr')) $('eq-mfr').value = eq.mfr || '';
  if ($('eq-model')) $('eq-model').value = eq.model || '';
  if ($('eq-serial')) $('eq-serial').value = eq.serial || '';
  document.querySelectorAll('#condition-chips .chip').forEach(c => c.classList.toggle('active', c.dataset.value === selectedCondition));
  document.querySelectorAll('#priority-chips .chip').forEach(c => c.classList.toggle('active', c.dataset.value === selectedPriority));
  await populateAreaSelect(eq.areaId);
  $('btn-delete-equipment').classList.remove('hidden');
  const photos = eq.photos || [];
  $('photo-count-badge').textContent = photos.length;
  $('photo-count-badge').className = 'badge ' + (photos.length===0?'danger':photos.length<2?'warn':'ok');
  renderPhotos(photos);
  setEqType(selectedEqType, { silent: true });
  renderShotGuide(photos);
  renderEqPager();
  renderCrumbs();
  renderVoiceNotes(eq.voiceNotes || []);
  persistSession();
}

function updatePromptChecks(photos) {
  renderShotGuide(photos || []);
}

function renderPhotos(photos) {
  const grid = $('photos-grid');
  if (!photos.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">No photos yet. Use the list above — tap Take on a shot.</p>';
    return;
  }
  grid.innerHTML = photos.map(p => `
    <div class="photo-thumb" data-id="${p.id}">
      <img src="${p.dataUrl}" alt="">
      ${p.promptType ? `<div class="photo-type-badge">${escapeHtml(shotLabel(p.promptType, selectedEqType))}</div>` : ''}
      ${p.note ? `<div class="photo-note-badge">${escapeHtml(p.note)}</div>` : ''}
    </div>
  `).join('');
  grid.querySelectorAll('.photo-thumb').forEach(t => {
    t.addEventListener('click', () => {
      currentPhotoId = t.dataset.id;
      const p = photos.find(x => x.id === currentPhotoId);
      openMarkup(t.querySelector('img').src, p);
    });
  });
}

async function saveEquipment(opts) {
  const tag = $('eq-tag').value.trim();
  if (!tag) { showToast('Tag required'); return; }
  if (!currentVisitId) { showToast('No visit'); return; }
  const now = Date.now();
  let eq;
  if (currentEquipmentId) {
    eq = await dbGet(STORE_EQUIPMENT, currentEquipmentId);
    if (!eq) return;
  } else {
    eq = { id: uuid(), visitId: currentVisitId, photos: [], createdAt: now };
    currentEquipmentId = eq.id;
  }
  eq.tag = tag;
  eq.areaId = $('eq-area').value || null;
  eq.locationDesc = $('eq-location').value.trim();
  eq.lat = parseFloat($('eq-lat').value) || null;
  eq.lng = parseFloat($('eq-lng').value) || null;
  eq.condition = selectedCondition || null;
  eq.priority = selectedPriority || null;
  eq.recommendation = $('eq-recommendation').value.trim();
  eq.notes = $('eq-notes').value.trim();
  eq.needsFollowup = $('eq-needs-followup').checked;
  eq.eqType = selectedEqType || 'other';
  eq.service = $('eq-service') ? $('eq-service').value.trim() : '';
  eq.pid = $('eq-pid') ? $('eq-pid').value.trim() : '';
  eq.lineNo = $('eq-line') ? $('eq-line').value.trim() : '';
  eq.mfr = $('eq-mfr') ? $('eq-mfr').value.trim() : '';
  eq.model = $('eq-model') ? $('eq-model').value.trim() : '';
  eq.serial = $('eq-serial') ? $('eq-serial').value.trim() : '';
  eq.updatedAt = now;
  await dbPut(STORE_EQUIPMENT, eq);
  const visit = await dbGet(STORE_VISITS, currentVisitId);
  if (visit) { visit.updatedAt = now; await dbPut(STORE_VISITS, visit); }
  if (!(opts && opts.silent)) {
    const nPhotos = (eq.photos || []).length;
    showToast(nPhotos ? 'Equipment saved' : 'Saved. Next: take a wide shot, then the nameplate.');
  }
  $('btn-delete-equipment').classList.remove('hidden');
  $('header-title').textContent = eq.tag;
  persistSession();
}

async function deleteEquipment() {
  if (!currentEquipmentId || !confirm('Delete this equipment and its photos?')) return;
  await dbDelete(STORE_EQUIPMENT, currentEquipmentId);
  showToast('Deleted');
  if (currentAreaId) { showView('view-area-detail'); loadAreaDetail(currentAreaId); }
  else { showView('view-visit-detail'); loadVisitDetail(currentVisitId); }
}

function getGPS() {
  captureGps({ toast: true, persist: true, fresh: true });
}

function loadCachedFix() {
  try {
    const s = JSON.parse(sessionStorage.getItem('fv_gps') || 'null');
    if (s && s.lat != null && Date.now() - s.at < 30 * 60 * 1000) lastFix = s;
  } catch (e) {}
}
function saveFix(pos) {
  lastFix = {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    acc: pos.coords.accuracy || 999,
    at: Date.now()
  };
  try { sessionStorage.setItem('fv_gps', JSON.stringify(lastFix)); } catch (e) {}
  updateGpsStatusUi();
  return lastFix;
}
function gpsErrorMessage(err) {
  const code = err && err.code;
  if (code === 1) return 'Location permission denied — allow location for this site, then tap GPS again.';
  if (code === 2) return 'GPS unavailable. Step outside or enter coordinates.';
  if (code === 3) return 'GPS timed out. Try again outdoors, or enter coordinates.';
  if (err && /unsupported/i.test(String(err.message))) return 'This browser has no GPS.';
  return 'Could not get location. Enter coordinates or try GPS again.';
}
function gpsToast(fix) {
  if (!fix) return 'Location saved';
  const m = Math.round(fix.acc);
  return m <= 25 ? 'Location ±' + m + ' m' : 'Location captured (±' + m + ' m). Stay still for a tighter fix.';
}
function gpsStatusText(fix) {
  if (!fix) return 'No GPS yet';
  const age = Math.round((Date.now() - fix.at) / 1000);
  const ageStr = age < 5 ? 'just now' : age < 60 ? age + 's ago' : Math.round(age / 60) + ' min ago';
  return '±' + Math.round(fix.acc) + ' m · ' + ageStr;
}
function updateGpsStatusUi() {
  const el = $('gps-status');
  if (!el) return;
  el.textContent = lastFix ? gpsStatusText(lastFix) : 'Tap GPS to capture this spot';
}
function applyFixToForm(fix) {
  if (!fix) return;
  if ($('eq-lat')) $('eq-lat').value = Number(fix.lat).toFixed(6);
  if ($('eq-lng')) $('eq-lng').value = Number(fix.lng).toFixed(6);
  updateGpsStatusUi();
}
function geolocateOnce(options) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      const e = new Error('unsupported');
      e.code = 0;
      return reject(e);
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}
async function locate(opts = {}) {
  const fresh = !!opts.fresh;
  const maxAge = opts.maxAge != null ? opts.maxAge : 45000;
  if (!fresh && lastFix && Date.now() - lastFix.at <= maxAge) return lastFix;

  const refine = () => {
    geolocateOnce({ enableHighAccuracy: true, timeout: 16000, maximumAge: 0 })
      .then((p) => {
        const f = saveFix(p);
        applyFixToForm(f);
      })
      .catch(() => {});
  };

  try {
    const pos = await geolocateOnce({
      enableHighAccuracy: false,
      timeout: 6000,
      maximumAge: fresh ? 8000 : maxAge
    });
    saveFix(pos);
    refine();
    return lastFix;
  } catch (e) {
    if (e && e.code === 1) throw e;
  }

  try {
    const pos = await geolocateOnce({
      enableHighAccuracy: true,
      timeout: 16000,
      maximumAge: fresh ? 0 : 8000
    });
    return saveFix(pos);
  } catch (e) {
    if (lastFix && Date.now() - lastFix.at < 15 * 60 * 1000) return lastFix;
    throw e;
  }
}
function startGpsWatch() {
  if (gpsWatchId != null || !navigator.geolocation) return;
  try {
    gpsWatchId = navigator.geolocation.watchPosition(
      pos => saveFix(pos),
      () => {},
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 25000 }
    );
  } catch (e) {}
}
async function persistGpsToCurrentEquipment(fix) {
  if (!fix || !currentEquipmentId) return;
  try {
    const eq = await dbGet(STORE_EQUIPMENT, currentEquipmentId);
    if (!eq) return;
    eq.lat = fix.lat;
    eq.lng = fix.lng;
    eq.gpsAcc = fix.acc;
    eq.updatedAt = Date.now();
    await dbPut(STORE_EQUIPMENT, eq);
  } catch (e) {}
}
async function captureGps(opts = {}) {
  if (!navigator.geolocation) {
    showToast('This browser has no GPS');
    updateGpsStatusUi();
    return null;
  }
  startGpsWatch();
  if (opts.toast) showToast('Getting location…');
  const status = $('gps-status');
  if (status) status.textContent = 'Getting location…';
  try {
    const fix = await locate({ fresh: !!opts.fresh, maxAge: opts.maxAge });
    applyFixToForm(fix);
    if (opts.persist) await persistGpsToCurrentEquipment(fix);
    if (opts.toast) showToast(gpsToast(fix));
    return fix;
  } catch (e) {
    if (lastFix) {
      applyFixToForm(lastFix);
      if (opts.persist) await persistGpsToCurrentEquipment(lastFix);
      if (opts.toast) showToast('Using last known location · ' + gpsStatusText(lastFix));
      return lastFix;
    }
    const msg = gpsErrorMessage(e);
    if (opts.toast) showToast(msg);
    if (status) status.textContent = msg;
    return null;
  }
}

function bindKeyboardSafe() {
  const root = document.getElementById('fv-root');
  if (!root || root.dataset.kb === '1') return;
  root.dataset.kb = '1';

  const apply = () => {
    const vv = window.visualViewport;
    if (!vv || !root) return;
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    root.style.setProperty('height', Math.round(vv.height) + 'px');
    root.style.setProperty('top', Math.round(vv.offsetTop) + 'px');
    root.style.setProperty('left', '0px');
    root.style.setProperty('right', '0px');
    root.style.setProperty('bottom', 'auto');
    root.style.setProperty('min-height', '0px');
    document.body.classList.toggle('kb-open', kb > 60);
  };

  if (window.visualViewport) {
    visualViewport.addEventListener('resize', apply);
    visualViewport.addEventListener('scroll', apply);
    apply();
  }

  document.addEventListener('focusin', (e) => {
    const t = e.target;
    if (!t || !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    document.body.classList.add('kb-open');
    setTimeout(() => {
      try { t.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }); } catch (err) {}
    }, 320);
  });
  document.addEventListener('focusout', () => {
    setTimeout(() => {
      const a = document.activeElement;
      if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
      if (window.visualViewport) apply();
      else document.body.classList.remove('kb-open');
    }, 180);
  });
}

function readFileAsDataURL(file) {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.readAsDataURL(file);
  });
}

async function handlePhotoSelect(e) {
  const input = e.target;
  const files = Array.from(input.files || []);
  try { input.value = ''; } catch (err) {}
  if (!files.length) return;

  showToast('Saving photo…');

  let images = [];
  try {
    for (const f of files) {
      const raw = await readFileAsDataURL(f);
      images.push(await compressDataUrl(raw, 0.72, 1600));
    }
  } catch (err) {
    console.error(err);
    showToast('Could not read that photo. Try again.');
    return;
  }

  restoreSession();

  if (!currentVisitId) {
    showToast('Open a visit first, then take the photo.');
    return;
  }

  try {
    if (!currentEquipmentId) {
      await ensureEquipmentName();
      if (!$('eq-tag')?.value.trim()) {
        showToast('Give it a name first — a tag like P-101 or just “Charge pump”');
        return;
      }
      await saveEquipment({ silent: true });
    }

    const eq = await dbGet(STORE_EQUIPMENT, currentEquipmentId);
    if (!eq) {
      showToast('Save this equipment, then take the photo again.');
      return;
    }

    eq.photos = eq.photos || [];
    const lockedShot = pendingShotType;
    let lastType = null;
    for (const dataUrl of images) {
      let dark = false;
      try { dark = await isImageDark(dataUrl); } catch (err) {}
      const autoType = lockedShot || pendingShotType || nextMissingPromptType(eq.photos, eq.eqType || selectedEqType);
      lastType = autoType;
      eq.photos.push({
        id: uuid(),
        dataUrl,
        note: dark ? 'Possibly dark' : '',
        promptType: autoType,
        lat: null,
        lng: null,
        capturedAt: Date.now()
      });
    }
    setPendingShot(null);
    eq.updatedAt = Date.now();
    try {
      await dbPut(STORE_EQUIPMENT, eq);
    } catch (err) {
      console.error(err);
      showToast('Shrinking photo to fit this device…');
      const start = eq.photos.length - images.length;
      for (let i = start; i < eq.photos.length; i++) {
        if (eq.photos[i]) eq.photos[i].dataUrl = await compressDataUrl(eq.photos[i].dataUrl, 0.52, 1024);
      }
      await dbPut(STORE_EQUIPMENT, eq);
    }

    renderPhotos(eq.photos);
    updatePromptChecks(eq.photos);
    if ($('photo-count-badge')) {
      $('photo-count-badge').textContent = String(eq.photos.length);
      $('photo-count-badge').className = 'badge ' + (eq.photos.length < 2 ? 'warn' : 'ok');
    }
    const shotName = lastType ? shotLabel(lastType, eq.eqType || selectedEqType) : 'Photo';
    const taken = guidedTypes(eq.photos);
    const nxt = shotsFor(eq.eqType || selectedEqType).find(s => !taken.has(s.id));
    showToast(shotName + ' saved' + (nxt ? ' · Next: ' + nxt.label : ' · Listed shots done'));
    persistSession();
    attachGpsToLatestPhotos(eq.id, images.length);
  } catch (err) {
    console.error(err);
    showToast('Photo did not save. Try one more time.');
  }
}

async function attachGpsToLatestPhotos(eqId, count) {
  try {
    const fix = await locate({ fresh: false, maxAge: 120000 });
    if (!fix) return;
    const fresh = await dbGet(STORE_EQUIPMENT, eqId);
    if (!fresh) return;
    const photos = fresh.photos || [];
    for (let i = photos.length - count; i < photos.length; i++) {
      if (i >= 0 && photos[i] && photos[i].lat == null) {
        photos[i].lat = fix.lat;
        photos[i].lng = fix.lng;
      }
    }
    if (fresh.lat == null) fresh.lat = fix.lat;
    if (fresh.lng == null) fresh.lng = fix.lng;
    applyFixToForm(fix);
    await dbPut(STORE_EQUIPMENT, fresh);
  } catch (e) {}
}

function isImageDark(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = 32; c.height = 32;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, 32, 32);
      const d = ctx.getImageData(0,0,32,32).data;
      let sum = 0;
      for (let i=0; i<d.length; i+=4) sum += (d[i]+d[i+1]+d[i+2])/3;
      resolve(sum / (d.length/4) < 50);
    };
    img.onerror = () => resolve(false);
    img.src = dataUrl;
  });
}

function ensureMarkupCanvas() {
  let canvas = $('markup-canvas');
  if (canvas) return canvas;
  const wrap = $('markup-canvas-wrap') || document.querySelector('.canvas-container');
  if (!wrap) return null;
  canvas = document.createElement('canvas');
  canvas.id = 'markup-canvas';
  wrap.appendChild(canvas);
  bindMarkupCanvas(canvas);
  return canvas;
}

function openMarkup(dataUrl, photoObj) {
  showView('view-markup');
  $('header-title').textContent = 'Markup';
  const canvas = ensureMarkupCanvas();
  if (!canvas) { showToast('Markup canvas unavailable'); return; }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const img = new Image();
  img.onload = () => {
    const maxW = canvas.parentElement.clientWidth || window.innerWidth - 32;
    const maxH = window.innerHeight * 0.5;
    let w = img.width, h = img.height;
    const r = Math.min(maxW / w, maxH / h, 1);
    w = Math.max(1, Math.floor(w * r));
    h = Math.max(1, Math.floor(h * r));
    canvas.width = w;
    canvas.height = h;
    // Improve drawing quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
  };
  img.onerror = () => showToast('Could not load image for markup');
  img.src = dataUrl;
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  const penBtn = document.querySelector('[data-tool="pen"]');
  if (penBtn) penBtn.classList.add('active');
  markupTool = 'pen';
  $('photo-note').value = photoObj?.note || '';
  $('photo-prompt-type').value = photoObj?.promptType || '';
}

function bindMarkupCanvas(canvas) {
  if (!canvas || canvas.dataset.fvBound === '1') return;
  canvas.dataset.fvBound = '1';
  const ctx = canvas.getContext('2d');
  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (cx-rect.left)*(canvas.width/rect.width), y: (cy-rect.top)*(canvas.height/rect.height) };
  }
  function start(e) {
    e.preventDefault(); isDrawing = true;
    const p = getPos(e); lastX = p.x; lastY = p.y;
    if (markupTool === 'text') {
      const t = prompt('Text:');
      if (t) { ctx.fillStyle='#ff3333'; ctx.font='bold 18px sans-serif'; ctx.fillText(t, p.x, p.y); }
      isDrawing = false;
    }
  }
  function move(e) {
    if (!isDrawing) return; e.preventDefault();
    const p = getPos(e);
    ctx.strokeStyle='#ff3333'; ctx.lineWidth=3; ctx.lineCap='round';
    if (markupTool==='pen') {
      ctx.beginPath(); ctx.moveTo(lastX,lastY); ctx.lineTo(p.x,p.y); ctx.stroke();
      lastX=p.x; lastY=p.y;
    }
  }
  function end(e) {
    if (!isDrawing) return; e.preventDefault();
    const p = getPos(e);
    if (markupTool==='arrow') {
      const ang = Math.atan2(p.y-lastY, p.x-lastX);
      ctx.beginPath(); ctx.moveTo(lastX,lastY); ctx.lineTo(p.x,p.y);
      ctx.lineTo(p.x-14*Math.cos(ang-Math.PI/6), p.y-14*Math.sin(ang-Math.PI/6));
      ctx.moveTo(p.x,p.y); ctx.lineTo(p.x-14*Math.cos(ang+Math.PI/6), p.y-14*Math.sin(ang+Math.PI/6));
      ctx.stroke();
    } else if (markupTool==='circle') {
      const r = Math.sqrt((p.x-lastX)**2 + (p.y-lastY)**2);
      ctx.beginPath(); ctx.arc(lastX,lastY,r,0,Math.PI*2); ctx.stroke();
    }
    isDrawing = false;
  }
  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup', end);
  canvas.addEventListener('mouseleave', end);
  canvas.addEventListener('touchstart', start, {passive:false});
  canvas.addEventListener('touchmove', move, {passive:false});
  canvas.addEventListener('touchend', end);
}

async function saveMarkup() {
  const dataUrl = $('markup-canvas').toDataURL('image/jpeg', 0.85);
  const note = $('photo-note').value.trim();
  const promptType = $('photo-prompt-type').value || null;
  const eq = await dbGet(STORE_EQUIPMENT, currentEquipmentId);
  if (!eq || !eq.photos) return;
  const photo = eq.photos.find(p => p.id === currentPhotoId);
  if (photo) {
    photo.dataUrl = dataUrl; photo.note = note; photo.promptType = promptType;
    eq.updatedAt = Date.now();
    await dbPut(STORE_EQUIPMENT, eq);
  }
  showToast('Photo saved');
  showView('view-equipment-detail');
  loadEquipmentDetail(currentEquipmentId);
}

function openQuickCapture() {
  qcPhotos = [];
  showView('view-quick-capture');
  $('header-title').textContent = 'Quick Capture';
  updateQcUI();
}
function updateQcUI() {
  $('qc-count').textContent = qcPhotos.length + ' photo' + (qcPhotos.length!==1?'s':'');
  $('btn-qc-assign').disabled = qcPhotos.length === 0;
  $('qc-preview').innerHTML = qcPhotos.map(p => `<img src="${p.dataUrl}">`).join('');
}
async function handleQcPhotos(e) {
  const files = Array.from(e.target.files || []);
  try { e.target.value = ''; } catch (err) {}
  if (!files.length) return;
  showToast('Saving…');
  const images = [];
  try {
    for (const f of files) {
      const raw = await readFileAsDataURL(f);
      images.push(await compressDataUrl(raw, 0.72, 1600));
    }
  } catch (err) {
    showToast('Could not read those photos.');
    return;
  }
  for (const dataUrl of images) {
    qcPhotos.push({ id: uuid(), dataUrl, lat: null, lng: null, capturedAt: Date.now() });
  }
  updateQcUI();
  showToast(images.length + ' added to queue');
  try {
    const fix = await locate({ fresh: false, maxAge: 120000 });
    if (!fix) return;
    const n = images.length;
    for (let i = qcPhotos.length - n; i < qcPhotos.length; i++) {
      if (qcPhotos[i]) { qcPhotos[i].lat = fix.lat; qcPhotos[i].lng = fix.lng; }
    }
  } catch (err) {}
}
function openAssignPhotos() {
  if (!qcPhotos.length) return;
  assignSelectedPhotoIds = new Set(qcPhotos.map(p => p.id));
  assignTargetEquipmentId = null;
  showView('view-assign-photos');
  $('header-title').textContent = 'Assign Photos';
  renderAssignUI();
}
async function renderAssignUI() {
  const items = await dbGetByIndex(STORE_EQUIPMENT, 'visitId', currentVisitId);
  items.sort((a,b)=>(a.tag||'').localeCompare(b.tag||''));
  const list = $('assign-equipment-list');
  list.innerHTML = items.length ? items.map(eq => `
    <div class="card" data-id="${eq.id}" style="${assignTargetEquipmentId===eq.id?'border-color:var(--accent)':''}">
      <div class="card-title"><span class="tag-badge">${escapeHtml(eq.tag)}</span></div>
      <div class="card-meta">${(eq.photos||[]).length} photos</div>
    </div>
  `).join('') : '<p class="help-text">No equipment yet.</p>';
  list.querySelectorAll('.card').forEach(c => {
    c.addEventListener('click', () => { assignTargetEquipmentId = c.dataset.id; renderAssignUI(); });
  });
  const photoSel = $('assign-photo-select');
  photoSel.innerHTML = qcPhotos.map(p => `
    <div class="photo-thumb ${assignSelectedPhotoIds.has(p.id)?'selected':''}" data-id="${p.id}"><img src="${p.dataUrl}"></div>
  `).join('');
  photoSel.querySelectorAll('.photo-thumb').forEach(t => {
    t.addEventListener('click', () => {
      const id = t.dataset.id;
      if (assignSelectedPhotoIds.has(id)) assignSelectedPhotoIds.delete(id);
      else assignSelectedPhotoIds.add(id);
      t.classList.toggle('selected');
      $('btn-confirm-assign').disabled = !assignTargetEquipmentId || assignSelectedPhotoIds.size===0;
    });
  });
  $('btn-confirm-assign').disabled = !assignTargetEquipmentId || assignSelectedPhotoIds.size===0;
}
async function confirmAssign() {
  if (!assignTargetEquipmentId || !assignSelectedPhotoIds.size) return;
  const eq = await dbGet(STORE_EQUIPMENT, assignTargetEquipmentId);
  eq.photos = eq.photos || [];
  const toAssign = qcPhotos.filter(p => assignSelectedPhotoIds.has(p.id));
  for (const p of toAssign) {
    const autoType = nextMissingPromptType(eq.photos, eq.eqType || 'other');
    eq.photos.push({
      id: p.id,
      dataUrl: p.dataUrl,
      note: '',
      promptType: autoType,
      lat: p.lat || null,
      lng: p.lng || null,
      capturedAt: p.capturedAt || Date.now()
    });
    // Fill equipment GPS if empty
    if (p.lat != null && (eq.lat == null || eq.lng == null)) {
      eq.lat = p.lat;
      eq.lng = p.lng;
    }
  }
  eq.updatedAt = Date.now();
  await dbPut(STORE_EQUIPMENT, eq);
  qcPhotos = qcPhotos.filter(p => !assignSelectedPhotoIds.has(p.id));
  showToast(toAssign.length + ' assigned');
  if (!qcPhotos.length) { showView('view-visit-detail'); loadVisitDetail(currentVisitId); }
  else { updateQcUI(); showView('view-quick-capture'); }
}
function openQuickEqModal() {
  $('qe-tag').value = ''; $('qe-location').value = '';
  $('modal-quick-eq').classList.remove('hidden');
}
async function saveQuickEq() {
  const tag = $('qe-tag').value.trim();
  if (!tag) { showToast('Tag required'); return; }
  const now = Date.now();
  const eq = {
    id: uuid(), visitId: currentVisitId, tag,
    locationDesc: $('qe-location').value.trim(),
    lat:null, lng:null, notes:'', photos:[], needsFollowup:false,
    eqType: 'other',
    createdAt: now, updatedAt: now
  };
  await dbPut(STORE_EQUIPMENT, eq);
  $('modal-quick-eq').classList.add('hidden');
  assignTargetEquipmentId = eq.id;
  renderAssignUI();
  showToast('Equipment created');
}

async function generatePDF() {
  const type = $('report-type').value;
  const company = $('report-company').value.trim();
  $('modal-report').classList.add('hidden');
  const visit = await dbGet(STORE_VISITS, currentVisitId);
  if (!visit) return;
  let items = await dbGetByIndex(STORE_EQUIPMENT, 'visitId', currentVisitId);
  const areas = await dbGetByIndex(STORE_AREAS, 'visitId', currentVisitId);
  if (type === 'exceptions') {
    items = items.filter(e => e.needsFollowup || !(e.photos||[]).length || e.condition==='Poor' || e.condition==='Critical' || e.priority==='High' || e.priority==='Urgent');
  }
  items.sort((a,b)=>(a.tag||'').localeCompare(b.tag||''));
  showToast('Generating PDF…');

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'letter' });
  const margin = 40;
  let y = margin;
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - margin*2;

  if (company) {
    doc.setFontSize(14); doc.setFont(undefined,'bold');
    doc.text(company, margin, y); y += 20;
  }
  doc.setFontSize(18); doc.setFont(undefined,'bold');
  const kind = copy().pdfKind[type] || copy().pdfKind.full;
  doc.text('FieldVault – ' + kind + ' Report', margin, y);
  y += 26;
  doc.setFontSize(11); doc.setFont(undefined,'normal');
  doc.text('Title: ' + (visit.title||''), margin, y); y += 15;
  if (visit.client) { doc.text('Client: ' + visit.client, margin, y); y += 15; }
  if (visit.facility) { doc.text('Facility: ' + visit.facility, margin, y); y += 15; }
  doc.text('Date: ' + formatDate(visit.date), margin, y); y += 15;
  doc.text('Generated: ' + new Date().toLocaleString(), margin, y); y += 18;
  if (visit.overallNotes && type !== 'exceptions') {
    doc.setFont(undefined,'bold'); doc.text('Overall Notes', margin, y); y += 13;
    doc.setFont(undefined,'normal');
    const s = doc.splitTextToSize(visit.overallNotes, contentW);
    doc.text(s, margin, y); y += s.length*13 + 12;
  }
  doc.setDrawColor(180); doc.line(margin, y, pageW-margin, y); y += 16;

  if (type === 'summary') {
    const withPhotos = items.filter(e => (e.photos||[]).length>0).length;
    const followups = items.filter(e => e.needsFollowup).length;
    doc.setFontSize(12);
    doc.text(`Equipment documented: ${items.length}`, margin, y); y += 16;
    doc.text(`With photos: ${withPhotos}`, margin, y); y += 16;
    doc.text(`Flagged for follow-up: ${followups}`, margin, y); y += 20;
    const critical = items.filter(e => e.condition==='Critical' || e.priority==='Urgent');
    if (critical.length) {
      doc.setFont(undefined,'bold'); doc.text('High priority / Critical items:', margin, y); y += 14;
      doc.setFont(undefined,'normal');
      critical.forEach(e => { doc.text('• ' + (e.tag||'') + (e.recommendation ? ' – ' + e.recommendation : ''), margin, y); y += 14; });
    }
  } else {
    for (const eq of items) {
      if (y > 680) { doc.addPage(); y = margin; }
      doc.setFontSize(13); doc.setFont(undefined,'bold'); doc.setTextColor(13,148,136);
      doc.text('Tag: ' + (eq.tag||'—'), margin, y); doc.setTextColor(0); y += 16;
      doc.setFontSize(10); doc.setFont(undefined,'normal');
      if (eq.areaId) {
        const area = areas.find(a => a.id === eq.areaId);
        if (area) { doc.text('Area: ' + area.name, margin, y); y += 13; }
      }
      if (eq.eqType) { doc.text('Type: ' + ((OG_TYPES[eq.eqType]||{}).label || eq.eqType), margin, y); y += 13; }
      if (eq.locationDesc) { doc.text('Location: ' + eq.locationDesc, margin, y); y += 13; }
      if (eq.service) { doc.text('Service: ' + eq.service, margin, y); y += 13; }
      if (eq.pid) { doc.text('P&ID: ' + eq.pid, margin, y); y += 13; }
      if (eq.lineNo) { doc.text('Line: ' + eq.lineNo, margin, y); y += 13; }
      if (eq.mfr) { doc.text('Manufacturer: ' + eq.mfr, margin, y); y += 13; }
      if (eq.model || eq.serial) { doc.text('Model / serial: ' + [eq.model, eq.serial].filter(Boolean).join(' / '), margin, y); y += 13; }
      if (eq.lat!=null && eq.lng!=null) { doc.text(`Coords: ${Number(eq.lat).toFixed(6)}, ${Number(eq.lng).toFixed(6)}`, margin, y); y += 13; }
      if (eq.condition) { doc.text('Condition: ' + eq.condition, margin, y); y += 13; }
      if (eq.priority) { doc.text('Priority: ' + eq.priority, margin, y); y += 13; }
      if (eq.recommendation) { doc.text('Recommendation: ' + eq.recommendation, margin, y); y += 13; }
      if (eq.needsFollowup) { doc.setTextColor(180,100,0); doc.text('⚑ Needs follow-up', margin, y); doc.setTextColor(0); y += 13; }
      if (eq.notes) {
        const ns = doc.splitTextToSize('Notes: ' + eq.notes, contentW);
        doc.text(ns, margin, y); y += ns.length*12 + 6;
      }
      if (type === 'full' && eq.photos && eq.photos.length) {
        for (const photo of eq.photos) {
          if (y > 600) { doc.addPage(); y = margin; }
          try {
            const props = doc.getImageProperties(photo.dataUrl);
            let iw = props.width, ih = props.height;
            const ratio = Math.min(contentW/iw, 200/ih);
            iw *= ratio; ih *= ratio;
            doc.addImage(photo.dataUrl, 'JPEG', margin, y, iw, ih);
            y += ih + 6;
            const cap = [photo.promptType ? shotLabel(photo.promptType, eq.eqType) : '', photo.note].filter(Boolean).join(' — ');
            if (cap) { doc.setFontSize(9); doc.setTextColor(80); doc.text(cap, margin, y); doc.setTextColor(0); y += 12; }
            y += 8;
          } catch(err) {}
        }
      }
      y += 10;
      doc.setDrawColor(220); doc.line(margin, y, pageW-margin, y); y += 14;
    }
  }
  if (!items.length) { doc.setFontSize(11); doc.text('No equipment items.', margin, y); }
  doc.save(`FieldVault_${(visit.title||'Visit').replace(/[^a-z0-9]/gi,'_').slice(0,30)}_${type}.pdf`);
  showToast('PDF ready');
}


// ===== Photos Library =====
async function openPhotosLibrary() {
  showView('view-photos-library');
  $('header-title').textContent = 'All Photos';
  const items = await dbGetByIndex(STORE_EQUIPMENT, 'visitId', currentVisitId);
  items.sort((a,b) => (a.tag||'').localeCompare(b.tag||''));
  const filter = $('photos-filter');
  filter.innerHTML = '<option value="all">All equipment</option>' +
    items.map(e => `<option value="${e.id}">${escapeHtml(e.tag||'Untitled')}</option>`).join('');
  const shotSel = $('photos-shot-filter');
  if (shotSel) {
    const ids = new Set();
    items.forEach(eq => (eq.photos||[]).forEach(p => { if (p.promptType) ids.add(p.promptType); }));
    const opts = [{ id: 'all', label: 'All shot types' }].concat(
      [...ids].map(id => ({ id, label: shotLabel(id) }))
    );
    shotSel.innerHTML = opts.map(o => `<option value="${o.id}">${escapeHtml(o.label)}</option>`).join('');
  }
  const rerender = () => renderPhotosLibrary(items, filter.value, shotSel ? shotSel.value : 'all');
  filter.onchange = rerender;
  if (shotSel) shotSel.onchange = rerender;
  rerender();
}

function renderPhotosLibrary(items, filterId, shotId) {
  const grid = $('photos-library-grid');
  let photos = [];
  for (const eq of items) {
    if (filterId !== 'all' && eq.id !== filterId) continue;
    for (const p of (eq.photos || [])) {
      if (shotId && shotId !== 'all' && p.promptType !== shotId) continue;
      photos.push({ ...p, tag: eq.tag, eqId: eq.id, eqLat: eq.lat, eqLng: eq.lng, eqType: eq.eqType });
    }
  }
  if (!photos.length) {
    grid.innerHTML = '<p style="color:var(--text-muted)">No photos yet for this visit.</p>';
    return;
  }
  grid.innerHTML = photos.map(p => `
    <div class="photo-thumb" data-eq="${p.eqId}" data-photo="${p.id}">
      <img src="${p.dataUrl}" alt="">
      ${p.promptType ? `<div class="photo-type-badge">${escapeHtml(shotLabel(p.promptType, p.eqType))}</div>` : ''}
      <div class="photo-lib-meta">
        <div class="tag">${escapeHtml(p.tag || '')}</div>
        ${p.lat != null ? `<div>${Number(p.lat).toFixed(5)}, ${Number(p.lng).toFixed(5)}</div>` : ''}
      </div>
    </div>
  `).join('');
  grid.querySelectorAll('.photo-thumb').forEach(t => {
    t.addEventListener('click', () => {
      currentEquipmentId = t.dataset.eq;
      currentPhotoId = t.dataset.photo;
      showView('view-equipment-detail');
      loadEquipmentDetail(currentEquipmentId);
    });
  });
}

// ===== Map =====
async function openMapView() {
  showView('view-map');
  $('header-title').textContent = 'Map';
  await initMap();
  refreshNearest();
}

async function initMap() {
  const items = await dbGetByIndex(STORE_EQUIPMENT, 'visitId', currentVisitId);
  const withGps = items.filter(e => e.lat != null && e.lng != null);

  const container = $('map-container');
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
  mapMarkers = [];

  // Default center
  let center = [39.5, -98.35];
  let zoom = 4;
  if (withGps.length) {
    center = [withGps[0].lat, withGps[0].lng];
    zoom = 17;
  }

  mapInstance = L.map(container).setView(center, zoom);

  const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap', maxZoom: 19
  });
  const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri', maxZoom: 19
  });

  if (currentMapLayer === 'satellite') satellite.addTo(mapInstance);
  else street.addTo(mapInstance);

  window._mapStreet = street;
  window._mapSat = satellite;

  const bounds = [];
  for (const eq of withGps) {
    // nearest neighbor distance for context
    let nearInfo = '';
    let best = Infinity, bestTag = '';
    for (const o of withGps) {
      if (o.id === eq.id) continue;
      const d = haversineM(eq.lat, eq.lng, o.lat, o.lng);
      if (d < best) { best = d; bestTag = o.tag || ''; }
    }
    if (best < Infinity) nearInfo = `<br><small>Nearest: ${escapeHtml(bestTag)} (${formatDist(best)})</small>`;
    const m = L.marker([eq.lat, eq.lng])
      .addTo(mapInstance)
      .bindPopup(`<strong>${escapeHtml(eq.tag || '')}</strong><br>${escapeHtml(eq.locationDesc || '')}${nearInfo}<br>
        <a href="https://maps.apple.com/?daddr=${eq.lat},${eq.lng}&q=${encodeURIComponent(eq.tag||'Equipment')}" target="_blank">Navigate (Apple)</a> ·
        <a href="https://www.google.com/maps/dir/?api=1&destination=${eq.lat},${eq.lng}" target="_blank">Navigate (Google)</a>`);
    mapMarkers.push(m);
    bounds.push([eq.lat, eq.lng]);
  }
  if (bounds.length > 1) mapInstance.fitBounds(bounds, { padding: [40, 40] });
  else if (bounds.length === 1) mapInstance.setView(bounds[0], 18);

  $('map-legend').innerHTML = withGps.length
    ? `<div>${withGps.length} equipment with GPS pinned</div><div>Tap a pin for navigation links</div>`
    : '<div>No GPS points yet. Take photos to auto-capture coordinates.</div>';

  // Fix leaflet size after view show
  setTimeout(() => mapInstance.invalidateSize(), 200);
}

function setMapLayer(layer) {
  currentMapLayer = layer;
  if (!mapInstance) return;
  if (layer === 'satellite') {
    mapInstance.removeLayer(window._mapStreet);
    window._mapSat.addTo(mapInstance);
  } else {
    mapInstance.removeLayer(window._mapSat);
    window._mapStreet.addTo(mapInstance);
  }
  document.querySelectorAll('#btn-map-satellite, #btn-map-street').forEach(b => b.classList.remove('active'));
  $(layer === 'satellite' ? 'btn-map-satellite' : 'btn-map-street').classList.add('active');
}

function mapLocateMe() {
  if (!mapInstance) { showToast('Map is not ready'); return; }
  (async () => {
    showToast('Locating…');
    const fix = await captureGps({ toast: false, persist: false, fresh: false });
    if (!fix) { showToast('Could not get location'); return; }
    mapInstance.setView([fix.lat, fix.lng], 18);
    L.circleMarker([fix.lat, fix.lng], { radius: 8, color: '#8fb8c9', fillColor: '#8fb8c9', fillOpacity: 0.8 })
      .addTo(mapInstance).bindPopup('You are here').openPopup();
    showToast(gpsToast(fix));
  })();
}

// ===== AI Photo Analysis =====
function getAiKey() {
  return localStorage.getItem('fieldvault_openai_key') || '';
}
function saveAiKey() {
  const key = $('ai-api-key').value.trim();
  if (key) localStorage.setItem('fieldvault_openai_key', key);
  else localStorage.removeItem('fieldvault_openai_key');
  $('modal-ai-key').classList.add('hidden');
  showToast(key ? 'API key saved on device' : 'Key cleared');
}
function openAiKeyModal() {
  $('ai-api-key').value = getAiKey();
  $('modal-ai-key').classList.remove('hidden');
}

async function analyzeCurrentPhoto() {
  const key = getAiKey();
  if (!key) {
    openAiKeyModal();
    showToast('Add your OpenAI API key first');
    return;
  }
  if (!currentEquipmentId || !currentPhotoId) {
    showToast('No photo selected');
    return;
  }
  const eq = await dbGet(STORE_EQUIPMENT, currentEquipmentId);
  const photo = (eq.photos || []).find(p => p.id === currentPhotoId);
  if (!photo) { showToast('Photo not found'); return; }

  showToast('Analyzing photo…');
  try {
    // Use a compressed data URL if huge
    let dataUrl = photo.dataUrl;
    if (dataUrl.length > 1_500_000) {
      dataUrl = await compressDataUrl(dataUrl, 0.6, 1280);
    }
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'You are helping an engineer collect reference photos for 3D modeling / digital twin work. Describe this site photo briefly: what equipment or structure is visible, any readable labels/tags/text, orientation clues, and anything useful for locating or modeling it later. Be concise (under 120 words).'
            },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }]
      })
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(err);
      if (res.status === 401) showToast('Invalid API key');
      else showToast('AI request failed (' + res.status + ')');
      return;
    }
    const data = await res.json();
    lastAiResult = data.choices?.[0]?.message?.content || 'No response';
    $('ai-result-text').textContent = lastAiResult;
    $('modal-ai-result').classList.remove('hidden');
  } catch (e) {
    console.error(e);
    showToast('AI analysis failed – check network / key');
  }
}

function compressDataUrl(dataUrl, quality, maxDim) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          const r = Math.min(maxDim / w, maxDim / h);
          w = Math.floor(w * r); h = Math.floor(h * r);
        }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', quality));
      } catch (e) {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function useAiAsNote() {
  if (!lastAiResult || !currentEquipmentId || !currentPhotoId) return;
  const eq = await dbGet(STORE_EQUIPMENT, currentEquipmentId);
  const photo = (eq.photos || []).find(p => p.id === currentPhotoId);
  if (photo) {
    photo.note = (photo.note ? photo.note + ' | ' : '') + lastAiResult.slice(0, 300);
    // also put on photo-note field if in markup
    if ($('photo-note')) $('photo-note').value = photo.note;
    eq.updatedAt = Date.now();
    await dbPut(STORE_EQUIPMENT, eq);
    showToast('Added to photo note');
  }
  $('modal-ai-result').classList.add('hidden');
}



// ===== Global Photos Library (all visits) =====
async function openGlobalPhotos() {
  const visits = await dbGetAll(STORE_VISITS);
  const equipment = await dbGetAll(STORE_EQUIPMENT);
  visits.sort((a,b) => (b.updatedAt||0) - (a.updatedAt||0));

  const filter = $('global-photos-filter');
  if (filter) {
    filter.innerHTML = '<option value="all">All visits</option>' +
      visits.map(v => `<option value="${v.id}">${escapeHtml(v.title || 'Untitled')}</option>`).join('');
    filter.onchange = () => renderGlobalPhotos(visits, equipment, filter.value);
  }
  renderGlobalPhotos(visits, equipment, filter ? filter.value : 'all');
}

function renderGlobalPhotos(visits, equipment, visitFilter) {
  const grid = $('global-photos-grid');
  if (!grid) return;
  const visitMap = Object.fromEntries(visits.map(v => [v.id, v]));
  let photos = [];
  for (const eq of equipment) {
    if (visitFilter !== 'all' && eq.visitId !== visitFilter) continue;
    for (const p of (eq.photos || [])) {
      photos.push({
        ...p,
        tag: eq.tag,
        eqId: eq.id,
        visitId: eq.visitId,
        visitTitle: (visitMap[eq.visitId] || {}).title || ''
      });
    }
  }
  // newest first roughly
  photos.reverse();
  if (!photos.length) {
    grid.innerHTML = '<div class="empty-state"><p>No photos stored yet.<br>Add photos during a visit and they will appear here.</p></div>';
    return;
  }
  grid.innerHTML = photos.map(p => `
    <div class="photo-thumb" data-eq="${p.eqId}" data-visit="${p.visitId}" data-photo="${p.id}">
      <img src="${p.dataUrl}" alt="">
      <div class="photo-lib-meta">
        <div class="tag">${escapeHtml(p.tag || '')}</div>
        <div>${escapeHtml(p.visitTitle)}</div>
        ${p.lat != null ? `<div>${Number(p.lat).toFixed(5)}, ${Number(p.lng).toFixed(5)}</div>` : ''}
      </div>
    </div>
  `).join('');
  grid.querySelectorAll('.photo-thumb').forEach(t => {
    t.addEventListener('click', () => {
      currentVisitId = t.dataset.visit;
      currentEquipmentId = t.dataset.eq;
      currentPhotoId = t.dataset.photo;
      showView('view-equipment-detail');
      loadEquipmentDetail(currentEquipmentId);
    });
  });
}

// ===== Global Map (all GPS points) =====
let globalMapInstance = null;

async function openGlobalMap() {
  const equipment = await dbGetAll(STORE_EQUIPMENT);
  const visits = await dbGetAll(STORE_VISITS);
  const visitMap = Object.fromEntries(visits.map(v => [v.id, v]));
  const withGps = equipment.filter(e => e.lat != null && e.lng != null);

  const container = $('global-map-container');
  if (!container) return;
  if (globalMapInstance) {
    globalMapInstance.remove();
    globalMapInstance = null;
  }

  let center = [39.5, -98.35], zoom = 4;
  if (withGps.length) {
    center = [withGps[0].lat, withGps[0].lng];
    zoom = 15;
  }

  globalMapInstance = L.map(container).setView(center, zoom);
  const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM', maxZoom: 19 });
  const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri', maxZoom: 19 });
  satellite.addTo(globalMapInstance);
  window._gStreet = street;
  window._gSat = satellite;

  const bounds = [];
  for (const eq of withGps) {
    const title = (visitMap[eq.visitId] || {}).title || '';
    L.marker([eq.lat, eq.lng]).addTo(globalMapInstance).bindPopup(
      `<strong>${escapeHtml(eq.tag || '')}</strong><br>${escapeHtml(title)}<br>
       <a href="https://maps.apple.com/?ll=${eq.lat},${eq.lng}&q=${encodeURIComponent(eq.tag||'')}" target="_blank">Apple Maps</a> ·
       <a href="https://www.google.com/maps/search/?api=1&query=${eq.lat},${eq.lng}" target="_blank">Google Maps</a>`
    );
    bounds.push([eq.lat, eq.lng]);
  }
  if (bounds.length > 1) globalMapInstance.fitBounds(bounds, { padding: [40, 40] });
  else if (bounds.length === 1) globalMapInstance.setView(bounds[0], 17);

  const legend = $('global-map-legend');
  if (legend) legend.innerHTML = withGps.length
    ? `<div>${withGps.length} locations pinned across all visits</div>`
    : '<div>No GPS points yet.</div>';

  setTimeout(() => globalMapInstance && globalMapInstance.invalidateSize(), 250);
}

function setGlobalMapLayer(layer) {
  if (!globalMapInstance) return;
  if (layer === 'satellite') {
    globalMapInstance.removeLayer(window._gStreet);
    window._gSat.addTo(globalMapInstance);
  } else {
    globalMapInstance.removeLayer(window._gSat);
    window._gStreet.addTo(globalMapInstance);
  }
  document.querySelectorAll('#btn-gmap-satellite, #btn-gmap-street').forEach(b => b.classList.remove('active'));
  $(layer === 'satellite' ? 'btn-gmap-satellite' : 'btn-gmap-street')?.classList.add('active');
}

function globalMapLocate() {
  if (!globalMapInstance) { showToast('Map is not ready'); return; }
  (async () => {
    const fix = await captureGps({ toast: true, persist: false, fresh: false });
    if (!fix) return;
    globalMapInstance.setView([fix.lat, fix.lng], 17);
    L.circleMarker([fix.lat, fix.lng], {
      radius: 8, color: '#8fb8c9', fillColor: '#8fb8c9', fillOpacity: 0.85
    }).addTo(globalMapInstance).bindPopup('You are here').openPopup();
  })();
}



// ===== Helpers: distance =====
function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toR = d => d * Math.PI / 180;
  const dLat = toR(lat2 - lat1);
  const dLng = toR(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toR(lat1))*Math.cos(toR(lat2))*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function formatDist(m) {
  if (m == null) return '';
  if (m < 1000) return Math.round(m) + ' m';
  return (m/1000).toFixed(2) + ' km';
}

function eqTimestamp(eq) {
  const photos = eq.photos || [];
  const times = photos.map(p => p.capturedAt || 0).filter(Boolean);
  if (times.length) return Math.min(...times);
  return eq.createdAt || eq.updatedAt || 0;
}

// ===== Modeling mode =====
function applyModelingMode(on) {
  document.body.classList.toggle('modeling-mode', !!on);
  localStorage.setItem('fieldvault_modeling', on ? '1' : '0');
  const btn = $('btn-model-mode');
  if (btn) btn.title = on ? 'Modeling Mode (ON)' : 'Modeling Mode';
  showToast(on ? 'Modeling mode on — maintenance fields hidden' : 'Modeling mode off');
}
function toggleModelingMode() {
  applyModelingMode(!document.body.classList.contains('modeling-mode'));
}

// ===== GPS clustering =====
function clusterByGps(items, radiusM = 25) {
  const pts = items.filter(e => e.lat != null && e.lng != null);
  const used = new Set();
  const clusters = [];
  for (let i = 0; i < pts.length; i++) {
    if (used.has(pts[i].id)) continue;
    const group = [pts[i]];
    used.add(pts[i].id);
    for (let j = i + 1; j < pts.length; j++) {
      if (used.has(pts[j].id)) continue;
      const d = haversineM(pts[i].lat, pts[i].lng, pts[j].lat, pts[j].lng);
      // also cluster if close to any member
      const near = group.some(g => haversineM(g.lat, g.lng, pts[j].lat, pts[j].lng) <= radiusM);
      if (near) { group.push(pts[j]); used.add(pts[j].id); }
    }
    clusters.push(group);
  }
  return clusters;
}

let pendingClusters = [];

async function suggestAreasFromGps() {
  const items = await dbGetByIndex(STORE_EQUIPMENT, 'visitId', currentVisitId);
  const clusters = clusterByGps(items, 25).filter(c => c.length >= 1);
  if (!clusters.length) {
    showToast('Need GPS on equipment first');
    return;
  }
  pendingClusters = clusters.map((c, i) => ({
    name: 'Area ' + (i + 1),
    items: c,
    selected: c.length >= 2 || clusters.length <= 4
  }));
  showView('view-cluster-review');
  $('header-title').textContent = copy().clusterTitle;
  renderClusterReview();
}

function renderClusterReview() {
  const list = $('cluster-list');
  if (!pendingClusters.length) {
    list.innerHTML = '<p class="help-text">No clusters.</p>';
    return;
  }
  list.innerHTML = pendingClusters.map((c, i) => `
    <div class="card cluster-item">
      <label class="checkbox-label">
        <input type="checkbox" data-i="${i}" ${c.selected ? 'checked' : ''}>
        Use this group (${c.items.length} item${c.items.length!==1?'s':''})
      </label>
      <input type="text" data-name="${i}" value="${escapeHtml(c.name)}" placeholder="Area name">
      <div class="cluster-eq">${c.items.map(e => escapeHtml(e.tag || 'Untitled')).join(' · ')}</div>
    </div>
  `).join('');
  list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => { pendingClusters[+cb.dataset.i].selected = cb.checked; });
  });
  list.querySelectorAll('input[type="text"]').forEach(inp => {
    inp.addEventListener('input', () => { pendingClusters[+inp.dataset.name].name = inp.value; });
  });
}

async function applyClusters() {
  const chosen = pendingClusters.filter(c => c.selected && (c.name || '').trim());
  if (!chosen.length) { showToast('Select at least one area'); return; }
  const now = Date.now();
  for (const c of chosen) {
    const area = {
      id: uuid(),
      visitId: currentVisitId,
      name: c.name.trim(),
      notes: 'Auto-grouped from GPS',
      createdAt: now,
      updatedAt: now
    };
    await dbPut(STORE_AREAS, area);
    for (const eq of c.items) {
      eq.areaId = area.id;
      eq.updatedAt = now;
      await dbPut(STORE_EQUIPMENT, eq);
    }
  }
  showToast(chosen.length + ' area(s) created');
  showView('view-visit-detail');
  loadVisitDetail(currentVisitId);
}

// ===== Walk sequence =====
async function openWalkSequence() {
  showView('view-walk-seq');
  $('header-title').textContent = 'Walk Path';
  const items = await dbGetByIndex(STORE_EQUIPMENT, 'visitId', currentVisitId);
  const events = [];
  for (const eq of items) {
    const photos = eq.photos || [];
    if (!photos.length) {
      events.push({ t: eqTimestamp(eq), kind: 'eq', eq });
    } else {
      for (const p of photos) {
        events.push({ t: p.capturedAt || eq.createdAt || 0, kind: 'photo', eq, photo: p });
      }
    }
  }
  events.sort((a,b) => a.t - b.t);
  const list = $('walk-seq-list');
  if (!events.length) {
    list.innerHTML = '<p class="help-text">Nothing captured yet.</p>';
    return;
  }
  list.innerHTML = events.map((ev, i) => {
    const time = ev.t ? new Date(ev.t).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'}) : '—';
    const thumb = ev.photo ? `<img src="${ev.photo.dataUrl}" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:8px">` : '';
    return `<div class="card" data-id="${ev.eq.id}">
      <div class="card-title">${i+1}. <span class="tag-badge">${escapeHtml(ev.eq.tag||'')}</span></div>
      <div class="card-meta">
        <span class="walk-time">${time}</span>
        ${ev.eq.lat!=null ? `<span class="coords-display">${Number(ev.eq.lat).toFixed(5)}, ${Number(ev.eq.lng).toFixed(5)}</span>` : ''}
      </div>
      ${thumb}
    </div>`;
  }).join('');
  list.querySelectorAll('.card').forEach(c => {
    c.addEventListener('click', () => {
      currentEquipmentId = c.dataset.id;
      showView('view-equipment-detail');
      loadEquipmentDetail(currentEquipmentId);
    });
  });
}

// ===== Nearest helpers =====
async function refreshNearest() {
  const list = $('nearest-list');
  if (!list) return;
  const items = await dbGetByIndex(STORE_EQUIPMENT, 'visitId', currentVisitId);
  const withGps = items.filter(e => e.lat != null && e.lng != null);
  if (!navigator.geolocation) {
    list.innerHTML = '<p class="help-text">GPS not available on this device.</p>';
    return;
  }
  startGpsWatch();
  showToast('Getting your location…');
  let fix = lastFix;
  try { fix = await locate({ fresh: false, maxAge: 60000 }); } catch (e) { fix = lastFix; }
  if (!fix) {
    list.innerHTML = '<p class="help-text">Could not get your location. Tap GPS on a piece of equipment first.</p>';
    return;
  }
  const lat = fix.lat, lng = fix.lng;
    const ranked = withGps.map(e => ({
      ...e,
      dist: haversineM(lat, lng, e.lat, e.lng)
    })).sort((a,b) => a.dist - b.dist);
    if (!ranked.length) {
      list.innerHTML = '<p class="help-text">No GPS points yet.</p>';
      return;
    }
    list.innerHTML = ranked.map(e => `
      <div class="card" data-id="${e.id}" data-lat="${e.lat}" data-lng="${e.lng}" data-tag="${escapeHtml(e.tag||'')}">
        <div class="card-title"><span class="tag-badge">${escapeHtml(e.tag||'')}</span>
          <span class="badge ok">${formatDist(e.dist)}</span>
        </div>
        <div class="card-meta">
          <a href="https://maps.apple.com/?daddr=${e.lat},${e.lng}&q=${encodeURIComponent(e.tag||'')}" target="_blank">Navigate</a>
          ·
          <a href="https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lng}" target="_blank">Google</a>
        </div>
      </div>
    `).join('');
    list.querySelectorAll('.card').forEach(c => {
      c.addEventListener('click', (ev) => {
        if (ev.target.tagName === 'A') return;
        currentEquipmentId = c.dataset.id;
        showView('view-equipment-detail');
        loadEquipmentDetail(currentEquipmentId);
      });
    });
}

// ===== Export package =====
function safeName(s) {
  return String(s || 'item').replace(/[^a-z0-9._-]+/gi, '_').slice(0, 40);
}

async function exportVisitPackage() {
  if (typeof JSZip === 'undefined') { showToast('ZIP library not loaded'); return; }
  const visit = await dbGet(STORE_VISITS, currentVisitId);
  if (!visit) return;
  const areas = await dbGetByIndex(STORE_AREAS, 'visitId', currentVisitId);
  const items = await dbGetByIndex(STORE_EQUIPMENT, 'visitId', currentVisitId);
  showToast('Building export…');

  const zip = new JSZip();
  const areaMap = Object.fromEntries(areas.map(a => [a.id, a.name]));
  const rows = [];
  const meta = {
    visit,
    areas,
    productMode,
    purpose: isDefense() ? 'ground-truth-reference' : 'facility-documentation',
    equipment: items.map(e => ({
      id: e.id, tag: e.tag, eqType: e.eqType || '',
      service: e.service || '', pid: e.pid || '', lineNo: e.lineNo || '',
      mfr: e.mfr || '', model: e.model || '', serial: e.serial || '',
      area: areaMap[e.areaId] || '',
      locationDesc: e.locationDesc, lat: e.lat, lng: e.lng,
      notes: e.notes, photoCount: (e.photos||[]).length,
      photoTypes: (e.photos||[]).map(p => p.promptType).filter(Boolean),
      readiness: equipmentReadiness(e)
    }))
  };
  zip.file('visit.json', JSON.stringify(meta, null, 2));
  if (isDefense()) {
    zip.file('README.txt', [
      'FieldVault ground-truth / digital-twin package',
      '',
      'This archive is structured for modeling and digital-twin workflows.',
      'equipment.csv includes GPS and reference-view types.',
      'Photos are grouped by sector/area and asset tag.',
      'External geospatial or drone layers can be aligned to the GPS points in equipment.csv.',
      '',
      'Visit: ' + (visit.title || ''),
      'Exported: ' + new Date().toISOString()
    ].join('\n'));
  }

  const csvCell = (v) => '"' + String(v ?? '').replace(/"/g, '') + '"';
  let csv = 'tag,type,service,pid,line,mfr,model,serial,area,location,lat,lng,notes,photo_file,view_type\n';
  let photoIdx = 1;
  for (const eq of items) {
    const areaName = areaMap[eq.areaId] || 'unassigned';
    const folder = 'photos/' + safeName(areaName) + '/' + safeName(eq.tag);
    const photos = eq.photos || [];
    const ident = [eq.tag||'', eq.eqType||'', eq.service||'', eq.pid||'', eq.lineNo||'', eq.mfr||'', eq.model||'', eq.serial||''];
    if (!photos.length) {
      csv += ident.map(csvCell).join(',') + ',' + csvCell(areaName) + ',' + csvCell(eq.locationDesc) + ',' + csvCell(eq.lat??'') + ',' + csvCell(eq.lng??'') + ',' + csvCell(eq.notes) + ',,\n';
    }
    for (const p of photos) {
      const fname = safeName(eq.tag) + '_' + (p.promptType || 'photo') + '_' + photoIdx + '.jpg';
      photoIdx++;
      const data = (p.dataUrl || '').split(',')[1];
      if (data) zip.file(folder + '/' + fname, data, { base64: true });
      csv += ident.map(csvCell).join(',') + ',' + csvCell(areaName) + ',' + csvCell(eq.locationDesc) + ',' + csvCell(p.lat??eq.lat??'') + ',' + csvCell(p.lng??eq.lng??'') + ',' + csvCell(p.note||eq.notes) + ',' + csvCell(folder + '/' + fname) + ',' + csvCell(p.promptType) + '\n';
    }
  }
  zip.file('equipment.csv', csv);

  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'FieldVault_' + safeName(visit.title) + '.zip';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Export downloaded');
}

// ===== Backup / restore =====
async function backupAllData() {
  const visits = await dbGetAll(STORE_VISITS);
  const areas = await dbGetAll(STORE_AREAS);
  const equipment = await dbGetAll(STORE_EQUIPMENT);
  const payload = {
    app: 'FieldVault',
    version: 5,
    exportedAt: new Date().toISOString(),
    visits, areas, equipment
  };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'FieldVault_backup_' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Backup saved');
}

async function restoreBackup(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.visits)) { showToast('Invalid backup file'); return; }
    if (!confirm('Restore will add this backup data onto this device. Continue?')) return;
    for (const v of (data.visits || [])) await dbPut(STORE_VISITS, v);
    for (const a of (data.areas || [])) await dbPut(STORE_AREAS, a);
    for (const e of (data.equipment || [])) await dbPut(STORE_EQUIPMENT, e);
    showToast('Backup restored');
    showView('view-visits');
  } catch (err) {
    console.error(err);
    showToast('Could not restore backup');
  }
}


function initEvents() {
  if ($('btn-back')?.dataset.fvEv === '1') return;
  if ($('btn-back')) $('btn-back').dataset.fvEv = '1';
  $('btn-back').addEventListener('click', goBack);
  $('btn-product-mode')?.addEventListener('click', toggleProductMode);
  $('btn-mode-commercial')?.addEventListener('click', () => setProductMode('commercial'));
  $('btn-mode-defense')?.addEventListener('click', () => setProductMode('defense'));
  $('btn-coach-dismiss')?.addEventListener('click', () => {
    try { localStorage.setItem('fieldvault_coach', '1'); } catch (e) {}
    renderCoach();
  });
  $('tile-add-eq')?.addEventListener('click', () => openNewEquipment(false));
  $('tile-quick')?.addEventListener('click', openQuickCapture);
  $('tile-map')?.addEventListener('click', openMapView);
  $('tile-missing')?.addEventListener('click', openReadyCheck);
  $('btn-new-visit').addEventListener('click', () => openVisitModal(false));
  $('btn-empty-new').addEventListener('click', () => openVisitModal(false));
  $('btn-save-visit').addEventListener('click', saveVisit);
  $('visit-template')?.addEventListener('change', () => {
    renderKindCards($('visit-template').value);
  });
  $('btn-highvis').addEventListener('click', toggleHighVis);

  document.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', () => $('modal-visit').classList.add('hidden')));
  document.querySelectorAll('.modal-close-area').forEach(b => b.addEventListener('click', () => $('modal-area').classList.add('hidden')));
  document.querySelectorAll('.modal-close-report').forEach(b => b.addEventListener('click', () => $('modal-report').classList.add('hidden')));
  document.querySelectorAll('.modal-close-qe').forEach(b => b.addEventListener('click', () => $('modal-quick-eq').classList.add('hidden')));

  $('btn-add-area').addEventListener('click', () => openAreaModal(false));
  $('btn-save-area').addEventListener('click', saveArea);
  $('btn-edit-area').addEventListener('click', async () => {
    const a = await dbGet(STORE_AREAS, currentAreaId);
    if (!a) return;
    $('area-name').value = a.name || '';
    $('area-notes').value = a.notes || '';
    openAreaModal(true);
  });
  $('btn-delete-area').addEventListener('click', deleteArea);
  $('btn-add-eq-to-area').addEventListener('click', () => openNewEquipment(true));

  $('btn-add-equipment').addEventListener('click', () => openNewEquipment(false));
  $('btn-save-equipment').addEventListener('click', saveEquipment);
  $('btn-delete-equipment').addEventListener('click', deleteEquipment);
  $('btn-edit-visit').addEventListener('click', async () => {
    const v = await dbGet(STORE_VISITS, currentVisitId);
    if (!v) return;
    $('visit-title').value = v.title||'';
    $('visit-client').value = v.client||'';
    if ($('visit-facility')) $('visit-facility').value = v.facility||'';
    $('visit-date').value = v.date||'';
    $('visit-notes').value = v.overallNotes||'';
    $('visit-template').value = v.template||'walkdown';
    renderKindCards(v.template||'walkdown');
    openVisitModal(true);
  });
  $('btn-delete-visit').addEventListener('click', deleteVisit);
  $('btn-generate-pdf').addEventListener('click', () => $('modal-report').classList.remove('hidden'));
  $('btn-do-report').addEventListener('click', generatePDF);
  $('btn-ready-check').addEventListener('click', openReadyCheck);
  $('btn-ready-done').addEventListener('click', () => { showView('view-visit-detail'); loadVisitDetail(currentVisitId); });
  $('btn-get-gps').addEventListener('click', getGPS);
  $('photo-input').addEventListener('change', handlePhotoSelect);
  $('photo-input-cam')?.addEventListener('change', handlePhotoSelect);
  $('eq-type-select')?.addEventListener('change', (e) => setEqType(e.target.value));

  $('btn-quick-capture').addEventListener('click', openQuickCapture);
  $('qc-photo-input').addEventListener('change', handleQcPhotos);
  $('btn-qc-assign').addEventListener('click', openAssignPhotos);
  $('btn-qc-done').addEventListener('click', () => {
    if (qcPhotos.length && !confirm('Leave queue?')) return;
    qcPhotos = [];
    showView('view-visit-detail');
    loadVisitDetail(currentVisitId);
  });
  $('btn-assign-new-eq').addEventListener('click', openQuickEqModal);
  $('btn-save-quick-eq').addEventListener('click', saveQuickEq);
  $('btn-confirm-assign').addEventListener('click', confirmAssign);

  $('btn-search').addEventListener('click', () => {
    $('search-bar').classList.toggle('hidden');
    if (!$('search-bar').classList.contains('hidden')) $('search-input').focus();
    else { $('search-input').value=''; renderVisitsList(); }
  });
  $('search-input').addEventListener('input', e => renderVisitsList(e.target.value.trim()));
  $('btn-clear-search').addEventListener('click', () => {
    $('search-input').value=''; renderVisitsList(); $('search-bar').classList.add('hidden');
  });

  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      markupTool = btn.dataset.tool;
    });
  });
  $('btn-save-markup').addEventListener('click', saveMarkup);
  $('btn-clear-markup').addEventListener('click', () => showToast('Re-add photo to start over'));

  $('btn-voice-eq-notes')?.addEventListener('click', function(){ startVoice('eq-notes', this); });
  $('btn-voice-visit-notes')?.addEventListener('click', function(){ startVoice('visit-notes', this); });
  $('btn-voice-photo-note')?.addEventListener('click', function(){ startVoice('photo-note', this); });

  document.querySelectorAll('#condition-chips .chip').forEach(c => {
    c.addEventListener('click', () => {
      document.querySelectorAll('#condition-chips .chip').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      selectedCondition = c.dataset.value;
    });
  });
  document.querySelectorAll('#priority-chips .chip').forEach(c => {
    c.addEventListener('click', () => {
      document.querySelectorAll('#priority-chips .chip').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      selectedPriority = c.dataset.value;
    });
  });


  // Map & Photos library
  // Bottom nav
  $('nav-visits')?.addEventListener('click', () => showView('view-visits'));
  $('nav-photos')?.addEventListener('click', () => showView('view-global-photos'));
  $('nav-map')?.addEventListener('click', () => showView('view-global-map'));
  $('nav-site')?.addEventListener('click', () => {
    if (!currentVisitId) { showToast('Open a visit first'); return; }
    showView('view-visit-detail');
    loadVisitDetail(currentVisitId);
  });
  $('btn-more')?.addEventListener('click', () => setMoreOpen(true));
  $('btn-more-close')?.addEventListener('click', () => setMoreOpen(false));
  $('more-backdrop')?.addEventListener('click', () => setMoreOpen(false));
  $('more-highvis')?.addEventListener('click', () => { setMoreOpen(false); toggleHighVis(); });
  $('more-defense')?.addEventListener('click', () => {
    setMoreOpen(false);
    toggleProductMode();
  });
  $('more-modeling')?.addEventListener('click', () => { setMoreOpen(false); toggleModelingMode(); });
  $('more-backup')?.addEventListener('click', () => { setMoreOpen(false); backupAllData(); });
  $('btn-gmap-satellite')?.addEventListener('click', () => setGlobalMapLayer('satellite'));
  $('btn-gmap-street')?.addEventListener('click', () => setGlobalMapLayer('street'));
  $('btn-gmap-locate')?.addEventListener('click', globalMapLocate);

  $('btn-open-map')?.addEventListener('click', openMapView);
  $('btn-suggest-areas')?.addEventListener('click', suggestAreasFromGps);
  $('btn-apply-clusters')?.addEventListener('click', applyClusters);
  $('btn-walk-seq')?.addEventListener('click', openWalkSequence);
  $('btn-export-package')?.addEventListener('click', exportVisitPackage);
  $('btn-backup')?.addEventListener('click', backupAllData);
  $('restore-input')?.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) restoreBackup(f);
    e.target.value = '';
  });
  $('btn-model-mode')?.addEventListener('click', toggleModelingMode);
  $('btn-refresh-nearest')?.addEventListener('click', refreshNearest);

  $('btn-open-photos')?.addEventListener('click', openPhotosLibrary);
  $('btn-map-satellite')?.addEventListener('click', () => setMapLayer('satellite'));
  $('btn-map-street')?.addEventListener('click', () => setMapLayer('street'));
  $('btn-map-locate')?.addEventListener('click', mapLocateMe);

  // AI
  $('btn-ai-analyze')?.addEventListener('click', analyzeCurrentPhoto);
  $('btn-save-ai-key')?.addEventListener('click', saveAiKey);
  $('btn-ai-use-note')?.addEventListener('click', useAiAsNote);
  document.querySelectorAll('.modal-close-ai').forEach(b => b.addEventListener('click', () => $('modal-ai-key').classList.add('hidden')));
  document.querySelectorAll('.modal-close-ai-result').forEach(b => b.addEventListener('click', () => $('modal-ai-result').classList.add('hidden')));
}

async function init() {
  try {
    if (!db) await openDB();
    initSpeech();
    initEvents();
    bindKeyboardSafe();
    loadCachedFix();
    updateGpsStatusUi();
    if (localStorage.getItem('fieldvault_modeling') === '1') {
      document.body.classList.add('modeling-mode');
    }
    const saved = localStorage.getItem('fieldvault_product_mode') === 'defense' ? 'defense' : 'commercial';
    applyProductMode(saved, { silent: true });
    restoreSession();
    showView('view-visits');
  } catch (err) {
    console.error(err);
    alert('Failed to start FieldVault');
  }
}

export async function initFieldVault() {
  await ensureFieldVaultLibs();
  await init();
}

  