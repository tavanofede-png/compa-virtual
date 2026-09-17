import { createContext, useContext } from "react";
import type { Repository, Envelope } from "@compa/client";
export interface AppContextValue {
  modal: string | null;
  repo: Repository;
  env: Envelope;
  busy: boolean;
  open: (name: string, value?: unknown) => void;
  go: (view: string) => void;
  run: (action: () => Promise<void>) => Promise<void>;
  command: (type: string, payload: unknown, close?: boolean) => Promise<void>;
  update: (env: Envelope) => void;
  close: () => void;
  leave: () => void;
  notice: (text: string) => void;
}
export const AppContext = createContext<AppContextValue>(null!);
export const useApp = () => useContext(AppContext);
