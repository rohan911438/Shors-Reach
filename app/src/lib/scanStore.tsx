import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

import { scan, type ProgressEvent, type Questionnaire, type ScanResult, type SourceName } from "../scan/index.js";

/** The QoreChain REST API has no CORS headers → go through the same-origin proxy (vite dev / Vercel rewrite). */
export const QORE_REST_PROXY = "/lcd-testnet";

export interface SourceProgress {
  source: SourceName;
  label: string;
  state: "run" | "ok" | "fail";
  error?: string;
}

interface ScanState {
  input: string | null;
  result: ScanResult | null;
  running: boolean;
  error: string | null;
  progress: SourceProgress[];
  info: string[];
  questionnaire: Questionnaire;
}

interface ScanApi extends ScanState {
  run: (input: string, q?: Questionnaire) => Promise<void>;
  setQuestionnaire: (q: Questionnaire) => void;
}

const Ctx = createContext<ScanApi | null>(null);

export function ScanProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ScanState>({
    input: null,
    result: null,
    running: false,
    error: null,
    progress: [],
    info: [],
    questionnaire: {},
  });
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (input: string, q?: Questionnaire) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState((s) => ({ ...s, input, running: true, error: null, progress: [], info: [], result: null, questionnaire: q ?? s.questionnaire }));
    const onProgress = (e: ProgressEvent) => {
      if (ctrl.signal.aborted) return;
      setState((s) => {
        if (e.type === "info") return { ...s, info: [...s.info.slice(-4), e.message] };
        const rest = s.progress.filter((p) => p.source !== e.source);
        const prev = s.progress.find((p) => p.source === e.source);
        if (e.type === "source-start") return { ...s, progress: [...rest, { source: e.source, label: e.label, state: "run" }] };
        return {
          ...s,
          progress: [...rest, { source: e.source, label: prev?.label ?? e.source, state: (e.ok ? "ok" : "fail") as SourceProgress["state"], error: e.error }].sort((a, b) =>
            a.label.localeCompare(b.label),
          ),
        };
      });
    };
    try {
      const result = await scan(input, {
        onProgress,
        signal: ctrl.signal,
        questionnaire: q ?? state.questionnaire,
        qoreRest: QORE_REST_PROXY,
      });
      if (!ctrl.signal.aborted) setState((s) => ({ ...s, result, running: false }));
    } catch (err) {
      if (!ctrl.signal.aborted) setState((s) => ({ ...s, running: false, error: err instanceof Error ? err.message : String(err) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setQuestionnaire = useCallback((q: Questionnaire) => setState((s) => ({ ...s, questionnaire: q })), []);
  const api = useMemo(() => ({ ...state, run, setQuestionnaire }), [state, run, setQuestionnaire]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useScan(): ScanApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useScan outside ScanProvider");
  return v;
}
