"use client";

import { useState } from "react";
import {
  Activity,
  CalendarDays,
  Check,
  CircleHelp,
  Dumbbell,
  Home,
  MessageCircle,
  Settings2,
  Sparkles,
  Zap,
} from "lucide-react";
import { useTraining } from "@/hooks/use-training";
import {
  days,
  makeSession,
  shiftWeek,
  weekOf,
  type Message,
  type Plan,
  type Session,
  type TrainingState,
} from "@/lib/training";
import { Today } from "@/components/Today";
import { WeekPlan } from "@/components/WeekPlan";
import { WorkoutLogger } from "@/components/WorkoutLogger";
import { Coach } from "@/components/Coach";
import { Progress } from "@/components/Progress";
import { Settings } from "@/components/Settings";
import { GeneratePlan } from "@/components/GeneratePlan";

const tabs = [
  { id: "today", label: "Today", icon: Home },
  { id: "week", label: "My week", icon: CalendarDays },
  { id: "progress", label: "Progress", icon: Activity },
  { id: "coach", label: "Coach", icon: MessageCircle },
] as const;
type Tab = (typeof tabs)[number]["id"];

export default function Momentum() {
  const {
    state,
    setState,
    aiConfigured,
    status,
    error,
    needsSignIn,
    retry,
    exportData,
  } = useTraining();
  const [tab, setTab] = useState<Tab>("today");
  const [week, setWeek] = useState(() => weekOf());
  const [day, setDay] = useState(() => (new Date().getDay() + 6) % 7);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [notice, setNotice] = useState("");

  function update(transform: (current: TrainingState) => TrainingState) {
    setState((current) => (current ? transform(current) : current));
  }
  function notify(text: string) {
    setNotice(text);
  }
  function navigate(next: Tab) {
    setTab(next);
    setSessionId(null);
    if (next === "today") {
      setWeek(weekOf());
      setDay((new Date().getDay() + 6) % 7);
    }
  }
  function viewDay(index: number) {
    setDay(index);
    setTab("today");
    setSessionId(null);
  }
  function acceptPlan(draft: Plan) {
    if (state?.sessions.some((session) => session.week === draft.week)) {
      notify("This week has started. Generate a plan for next week instead.");
      return;
    }
    update((current) => ({
      ...current,
      plans: { ...current.plans, [draft.week]: draft },
    }));
    setGeneratorOpen(false);
    setTab("week");
    notify("Your new draft is ready. Review it, then commit to your week.");
  }
  function commitPlan() {
    update((current) => ({
      ...current,
      plans: {
        ...current.plans,
        [week]: { ...current.plans[week], committed: true },
      },
    }));
    notify("Week committed. One session at a time.");
  }
  function swapDays(from: number, to: number) {
    update((current) => {
      if (
        current.sessions.some(
          (session) =>
            session.week === week && [from, to].includes(session.day),
        )
      )
        return current;
      const plan = current.plans[week];
      const workouts = [...plan.days];
      [workouts[from], workouts[to]] = [workouts[to], workouts[from]];
      return {
        ...current,
        plans: { ...current.plans, [week]: { ...plan, days: workouts } },
      };
    });
    notify("Days swapped. Your commitment stays the same.");
  }
  function startSession() {
    if (!state?.plans[week]) return;
    const existing = state.sessions.find(
      (session) => session.week === week && session.day === day,
    );
    if (existing) {
      setSessionId(existing.id);
      return;
    }
    const active = state.sessions.find((session) => !session.finished);
    if (active) {
      setSessionId(active.id);
      notify("Let’s finish or log your in-progress session first.");
      return;
    }
    const session = makeSession(state.plans[week], day, state.profile.units);
    update((current) => ({
      ...current,
      sessions: [...current.sessions, session],
    }));
    setSessionId(session.id);
  }
  function changeSession(changed: Session) {
    update((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === changed.id ? changed : session,
      ),
    }));
  }
  function addMessage(message: Message) {
    update((current) => ({
      ...current,
      messages: [...current.messages, message].slice(-100),
    }));
  }
  function applyProposal(id: string) {
    if (!state) return;
    const message = state.messages.find((item) => item.id === id);
    const proposal = message?.proposal;
    if (!proposal || message.applied) return;
    if (
      state.sessions.some(
        (session) =>
          session.week === proposal.week && session.day === proposal.day,
      )
    ) {
      notify(
        "That session has started. Your log and workout have been preserved.",
      );
      return;
    }
    update((current) => {
      const plan = current.plans[proposal.week];
      if (!plan) return current;
      return {
        ...current,
        plans: {
          ...current.plans,
          [proposal.week]: {
            ...plan,
            days: plan.days.map((workout, index) =>
              index === proposal.day ? proposal.workout : workout,
            ),
          },
        },
        messages: current.messages.map((item) =>
          item.id === id ? { ...item, applied: true } : item,
        ),
      };
    });
    notify("Proposed change applied to your plan.");
  }

  if (!state)
    return (
      <main className="loading-screen">
        <Zap size={38} />
        <h1>momentum</h1>
        <p>{error || "Getting your week ready…"}</p>
        {needsSignIn ? (
          <a
            className="primary"
            href="/signin-with-chatgpt?return_to=%2F"
            target="_top"
          >
            Sign in to Momentum
          </a>
        ) : (
          error && (
            <button
              className="secondary"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          )
        )}
      </main>
    );

  const plan = state.plans[week];
  const session = state.sessions.find((item) => item.id === sessionId);
  const sessionWorkout = session
    ? state.plans[session.week]?.days[session.day]
    : null;
  const isToday = week === weekOf() && day === (new Date().getDay() + 6) % 7;
  const heading =
    tab === "today"
      ? `${isToday ? "Let’s show up" : `Your ${days[day].toLowerCase()}`}, ${state.profile.name}.`
      : tab === "week"
        ? "Your week. Your word."
        : tab === "progress"
          ? "Look how far you’ve come."
          : "A coach in your corner.";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Momentum home">
          <span>
            <Zap size={25} fill="currentColor" />
          </span>
          momentum<span className="brand-period">.</span>
        </a>
        <span className="sidebar-caption">MAKE SHOWING UP A HABIT</span>
        <nav aria-label="Main navigation">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={20} />
              <span>{label}</span>
              {id === "coach" && <span className="nav-ai">AI</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="program-label">
            <Dumbbell size={20} />
            <div>
              <strong>Strength + conditioning</strong>
              <span>Your personal program</span>
            </div>
          </div>
          <button
            className="profile-button"
            onClick={() => setSettingsOpen(true)}
          >
            <span className="avatar">
              {state.profile.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{state.profile.name}</strong>
              <span>Training preferences</span>
            </div>
            <Settings2 size={18} />
          </button>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <span>
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </span>
          <div>
            <span className={`connection ${aiConfigured ? "connected" : ""}`}>
              <Sparkles size={14} />
              {aiConfigured ? "AI connected" : "AI setup pending"}
            </span>
            <button
              className="icon-button mobile-settings"
              aria-label="Training preferences"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 size={19} />
            </button>
          </div>
        </header>
        {error && (
          <div className="error-banner" role="alert">
            <p>{error}</p>
            <button className="secondary" onClick={retry}>
              Retry save
            </button>
            <button className="text-button" onClick={exportData}>
              Export unsaved data
            </button>
          </div>
        )}
        {notice && (
          <div className="notice" role="status">
            <Check size={17} />
            <span>{notice}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              ×
            </button>
          </div>
        )}
        {session && sessionWorkout ? (
          <WorkoutLogger
            session={session}
            workout={sessionWorkout}
            onChange={changeSession}
            onDiscard={() => {
              update((current) => ({
                ...current,
                sessions: current.sessions.filter(
                  (item) => item.id !== session.id,
                ),
              }));
              setSessionId(null);
            }}
            onClose={() => setSessionId(null)}
            onFinish={() => {
              changeSession({ ...session, finished: new Date().toISOString() });
              setSessionId(null);
              setTab("progress");
              notify("Logged. You showed up, and that counts.");
            }}
          />
        ) : (
          <>
            <div className="page-heading">
              <div>
                <span className="eyebrow">
                  {tab === "today"
                    ? "SMALL PROMISES. REAL PROGRESS."
                    : "BUILT AROUND YOU"}
                </span>
                <h1>{heading}</h1>
                <p>
                  {tab === "today"
                    ? "Your next step is already planned."
                    : tab === "week"
                      ? "A little structure. A lot less guesswork."
                      : tab === "progress"
                        ? "Consistency is a skill. You’re practicing it."
                        : "Adjust the plan. Find your next step. Keep going."}
                </p>
              </div>
              {tab === "today" && (
                <button className="secondary" onClick={() => setTab("week")}>
                  <CalendarDays size={17} /> View my week
                </button>
              )}
            </div>
            {tab === "today" &&
              (plan ? (
                <Today
                  state={state}
                  plan={plan}
                  day={day}
                  onStart={startSession}
                  onDay={viewDay}
                  onEnergy={(energy) =>
                    update((current) => ({ ...current, energy }))
                  }
                  onCoach={() => setTab("coach")}
                  onCommit={commitPlan}
                />
              ) : (
                <section className="panel empty-state">
                  <h2>Your next chapter starts here.</h2>
                  <p>Let’s make a plan for this week.</p>
                  <button
                    className="primary"
                    onClick={() => setGeneratorOpen(true)}
                  >
                    Plan my week
                  </button>
                </section>
              ))}
            {tab === "week" && (
              <WeekPlan
                state={state}
                week={week}
                plan={plan}
                onWeek={(delta) => setWeek(shiftWeek(week, delta))}
                onGenerate={() => setGeneratorOpen(true)}
                onDay={viewDay}
                onCommit={commitPlan}
                onSwap={swapDays}
              />
            )}
            {tab === "progress" && (
              <Progress
                state={state}
                week={weekOf()}
                onSession={setSessionId}
                onExport={exportData}
              />
            )}
            {tab === "coach" && (
              <Coach
                state={state}
                week={week}
                aiConfigured={aiConfigured}
                onMessage={addMessage}
                onApply={applyProposal}
              />
            )}
          </>
        )}
        <footer className="app-footer">
          <span>{status}</span>
          <span>
            <CircleHelp size={13} /> Personal prototype · private training data
          </span>
        </footer>
      </main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            aria-current={tab === id ? "page" : undefined}
            className={tab === id ? "active" : ""}
            onClick={() => navigate(id)}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {settingsOpen && (
        <Settings
          profile={state.profile}
          onClose={() => setSettingsOpen(false)}
          onSave={(profile) => {
            update((current) => ({ ...current, profile }));
            setSettingsOpen(false);
            notify("Preferences saved for your next plan.");
          }}
        />
      )}
      {generatorOpen && (
        <GeneratePlan
          state={state}
          week={week}
          aiConfigured={aiConfigured}
          onClose={() => setGeneratorOpen(false)}
          saved={status === "All changes saved" && !error}
          onAccept={acceptPlan}
        />
      )}
    </div>
  );
}
