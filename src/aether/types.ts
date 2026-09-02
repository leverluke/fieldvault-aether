export type Ctx = {
  navigate: (to: string) => void;
  pathname: string;
  onTimer: (label: string) => void;
};

export type Action = {
  kind: "call" | "maps" | "sms" | "copy" | "mail" | "confirm" | "cancel";
  label: string;
  href?: string;
  copy?: string;
};

export type Reply = {
  text: string;
  speak?: string;
  ran?: string;
  actions?: Action[];
  timerSec?: number;
  timerLabel?: string;
  dial?: string;
  why?: string;
};
