export type MemoryKind =
  | "fact"
  | "preference"
  | "project"
  | "open_loop"
  | "lesson"
  | "receipt";

export type SkillKind = "plan" | "food" | "parts" | "project" | "craft";

export type FulfillKind = "food" | "parts" | "call" | "message" | "web";

export type FulfillStatus =
  | "draft"
  | "needs_connector"
  | "running"
  | "done"
  | "failed";

export type CardStatus =
  | "draft"
  | "confirmed"
  | "rejected"
  | "executing"
  | "fulfilled"
  | "failed"
  | "needs_connector";

export type MemoryEntry = {
  id: string;
  kind: MemoryKind;
  text: string;
  meta?: Record<string, string>;
  at: number;
  forgotten?: boolean;
};

export type Fulfillment = {
  id: string;
  kind: FulfillKind;
  status: FulfillStatus;
  whatLeviSaid: string;
  receipt?: string;
  failReason?: string;
};

export type DraftArtifact = {
  who?: string;
  what: string;
  when?: string;
  message?: string;
  url?: string;
  tel?: string;
  mailto?: string;
  copy?: string;
  maps?: string;
};

export type DraftCard = {
  id: string;
  skill: SkillKind;
  title: string;
  plan: string[];
  draft: DraftArtifact;
  status: CardStatus;
  source: string;
  at: number;
  fulfillment?: Fulfillment;
  projectId?: string;
};

export type ProjectAttach = {
  id: string;
  label: string;
  goal: string;
  constraints: string[];
  paths: string[];
  nextMoves: string[];
  blockers: string[];
  attachedAt: number;
};

export type OperatorState = {
  memories: MemoryEntry[];
  cards: DraftCard[];
  projects: ProjectAttach[];
  activeCardId: string | null;
  activeProjectId: string | null;
};

export type Kv = {
  get(k: string): string | null;
  set(k: string, v: string): void;
  remove(k: string): void;
};

export declare const STORAGE_KEY: string;
export declare const CONFIRM_PHRASES: RegExp;
export declare const PROJECT_MAPS: Record<
  string,
  Omit<ProjectAttach, "attachedAt">
>;

export declare function uid(): string;
export declare function emptyState(): OperatorState;
export declare function loadState(kv: Kv): OperatorState;
export declare function saveState(kv: Kv, state: OperatorState): void;
export declare function liveMemories(state: OperatorState): MemoryEntry[];
export declare function makeMemory(
  text: string,
  kind: MemoryKind,
  meta?: Record<string, string>,
): MemoryEntry;
export declare function parseMemoryStatement(
  q: string,
): { kind: MemoryKind; text: string } | null;
export declare function isConfirmPhrase(q: string): boolean;
export declare function parseProjectAttach(q: string): string | null;
export declare function pickSkill(q: string): SkillKind | null;
export declare function memoryContext(state: OperatorState, q: string): string;
export declare function attachProject(id: string): ProjectAttach;
export declare function buildSkillCard(
  state: OperatorState,
  q: string,
  env?: { hullLabel?: string },
): DraftCard;
export declare function fulfillCard(
  card: DraftCard,
  whatLeviSaid: string,
  adapters?: {
    copyText?: (t: string) => boolean;
    openUrl?: (url: string) => boolean;
    hasTwilio?: boolean;
    share?: (t: string) => boolean;
  },
): { card: DraftCard; fulfillment: Fulfillment; reply: string };
export declare function rejectCard(
  state: OperatorState,
  cardId: string,
  reason: string,
): { state: OperatorState; lesson: MemoryEntry; reply: string };
export declare function operatorTurn(
  state: OperatorState,
  q: string,
  env?: {
    hullLabel?: string;
    hasTwilio?: boolean;
    copyText?: (t: string) => boolean;
    openUrl?: (url: string) => boolean;
    share?: (t: string) => boolean;
  },
): { state: OperatorState; reply: string; card?: DraftCard; kind: string };
export declare function forgetMemoryById(
  memories: MemoryEntry[],
  id: string,
): MemoryEntry[];
