"use client";

import { useEffect, useRef, useState } from "react";
import { initialState, type TrainingState } from "@/lib/training";

export function useTraining() {
  const [state, setState] = useState<TrainingState | null>(null);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [status, setStatus] = useState("Loading your training…");
  const [error, setError] = useState("");
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const revision = useRef(0);
  const persisted = useRef<TrainingState | null>(null);
  const pending = useRef<TrainingState | null>(null);
  const saving = useRef(false);
  const blocked = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/state")
      .then(async (response) => {
        const data = (await response.json()) as {
          error: string;
          revision: number;
          aiConfigured: boolean;
          state: TrainingState | null;
        };
        if (!response.ok) {
          setNeedsSignIn(response.status === 401);
          throw new Error(data.error);
        }
        if (cancelled) return;
        revision.current = data.revision;
        setAiConfigured(data.aiConfigured);
        persisted.current = data.state;
        setState(data.state || initialState());
        setStatus("All changes saved");
      })
      .catch((reason) => {
        if (!cancelled) setError(reason.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function savePending() {
    if (saving.current || blocked.current) return;
    saving.current = true;
    try {
      while (pending.current) {
        const snapshot = pending.current;
        pending.current = null;
        const response = await fetch("/api/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: snapshot, revision: revision.current }),
        });
        const result = (await response.json()) as {
          error: string;
          revision: number;
        };
        if (!response.ok) {
          pending.current = pending.current || snapshot;
          blocked.current = response.status === 409;
          throw new Error(result.error);
        }
        revision.current = result.revision;
        persisted.current = snapshot;
      }
      setStatus("All changes saved");
      setError("");
    } catch (reason) {
      setStatus("Changes not saved");
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to save. Please retry.",
      );
    } finally {
      saving.current = false;
    }
  }

  useEffect(() => {
    if (!state || state === persisted.current) return;
    pending.current = state;
    setStatus("Saving…");
    const timer = setTimeout(savePending, 500);
    return () => clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (pending.current || saving.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  function exportData() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "momentum-training.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return {
    state,
    setState,
    aiConfigured,
    status,
    error,
    needsSignIn,
    retry: savePending,
    exportData,
  };
}
