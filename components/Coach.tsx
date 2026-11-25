import { useState } from "react";
import { Check, MessageCircle, Send, Sparkles } from "lucide-react";
import { days, type Message, type TrainingState } from "@/lib/training";

type Props = {
  state: TrainingState;
  week: string;
  aiConfigured: boolean;
  onMessage: (message: Message) => void;
  onApply: (id: string) => void;
};

export function Coach({
  state,
  week,
  aiConfigured,
  onMessage,
  onApply,
}: Props) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!input.trim() || busy) return;
    const text = input.trim();
    const message: Message = { id: crypto.randomUUID(), role: "user", text };
    onMessage(message);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "chat", state, week, message: text }),
      });
      const data = (await response.json()) as {
        error: string;
        message: string;
        proposal?: Omit<NonNullable<Message["proposal"]>, "week">;
      };
      if (!response.ok) throw new Error(data.error);
      onMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        text: data.message,
        ...(data.proposal ? { proposal: { ...data.proposal, week } } : {}),
      });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The coach is unavailable. Please retry.",
      );
      setInput(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="coach-layout">
      <section className="panel chat-panel">
        <div className="chat-header">
          <div className="coach-avatar">
            <Sparkles size={21} />
          </div>
          <div>
            <h3>Your corner. Your coach.</h3>
            <p>
              {aiConfigured
                ? "Live AI · knows your plan and recent logs"
                : "Live AI not connected yet"}
            </p>
          </div>
        </div>
        <div className="chat-messages" aria-live="polite">
          <div className="chat-bubble assistant">
            <span className="eyebrow">MOMENTUM</span>
            <p>
              Let’s make your plan fit your life. I can help with exercise
              swaps, shorter sessions, or a little perspective when showing up
              feels hard.
            </p>
            {!aiConfigured && (
              <p className="connection-note">
                Chat becomes available when your server’s API key is connected.
                Your workout plan and logging work now.
              </p>
            )}
          </div>
          {state.messages.map((message) => (
            <div className={`chat-bubble ${message.role}`} key={message.id}>
              <span className="eyebrow">
                {message.role === "user" ? "YOU" : "MOMENTUM"}
              </span>
              <p>{message.text}</p>
              {message.proposal && (
                <div className="proposal">
                  <span className="eyebrow">
                    PROPOSED CHANGE · {days[message.proposal.day]}
                  </span>
                  <h4>{message.proposal.workout.title}</h4>
                  <p>{message.proposal.reason}</p>
                  <ul>
                    {message.proposal.workout.exercises.map((exercise) => (
                      <li key={exercise.name}>
                        {exercise.name} · {exercise.sets} × {exercise.target}{" "}
                        {exercise.unit}
                      </li>
                    ))}
                  </ul>
                  <button
                    className="secondary"
                    disabled={message.applied}
                    onClick={() => onApply(message.id)}
                  >
                    {message.applied ? <Check size={16} /> : null}
                    {message.applied ? "Applied" : "Apply to my plan"}
                  </button>
                </div>
              )}
            </div>
          ))}
          {busy && <p className="thinking">Coach is thinking…</p>}
        </div>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <form className="chat-form" onSubmit={send}>
          <label className="sr-only" htmlFor="coach-message">
            Message your coach
          </label>
          <textarea
            id="coach-message"
            maxLength={2000}
            rows={2}
            placeholder={
              aiConfigured
                ? "What’s on your mind?"
                : "Connect AI to start chatting"
            }
            value={input}
            disabled={!aiConfigured || busy}
            onChange={(event) => setInput(event.target.value)}
          />
          <button
            className="primary"
            aria-label="Send message"
            disabled={!aiConfigured || busy || !input.trim()}
          >
            <Send size={18} />
          </button>
        </form>
        <p className="chat-disclosure">
          Your profile, plan, and recent logs are shared with OpenAI when you
          send. Plan changes require your approval.
        </p>
      </section>
      <aside className="panel chat-ideas">
        <MessageCircle size={23} />
        <h3>Start here</h3>
        {[
          "How am I doing with consistency?",
          "Adapt Monday to a 35-minute home workout.",
          "Help me get back on track after a missed session.",
        ].map((prompt) => (
          <button
            key={prompt}
            className="prompt-button"
            onClick={() => setInput(prompt)}
          >
            {prompt}
          </button>
        ))}
        <p>
          Coaching supports training decisions. For pain or injury, get advice
          from a qualified professional.
        </p>
      </aside>
    </div>
  );
}
