"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, Target, X } from "lucide-react";
import { useThemeMode } from "@/hooks/useTheme";
import api from "@/lib/axios";
import { isAxiosError } from "axios";
import {
  modes,
  type ModeId,
  type TrainingDashboard,
} from "@/components/training/training-types";
import { TrainingInsights } from "@/components/training/TrainingInsights";
import {
  PlayNavigation,
  PlayModeLibrary,
  PlayPulse,
  PlayMissionShortcut,
} from "@/components/training/PlayHub";
import "./play.css";
import "./play-hub.css";

export default function PlayPage() {
  const { theme } = useThemeMode();
  const router = useRouter();
  const [tab, setTab] = useState("Play"),
    [exam, setExam] = useState("ssc-cgl");
  const [dashboard, setDashboard] = useState<TrainingDashboard | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<ModeId | null>(null),
    [subject, setSubject] = useState(""),
    [topic, setTopic] = useState(""),
    [count, setCount] = useState<number | "full">(20),
    [tier, setTier] = useState("1"),
    [minutes, setMinutes] = useState(10);
  const selectedMode = modes.find((m) => m.id === selected);
  useEffect(() => {
    let live = true;
    api
      .get<TrainingDashboard>("/api/training/dashboard", { params: { exam } })
      .then(({ data }) => {
        if (live) setDashboard(data);
      })
      .catch((e) => {
        if (live)
          setError(
            isAxiosError(e)
              ? e.response?.data?.error ||
                  "Could not load your training profile."
              : "Could not load training.",
          );
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [exam]);
  useEffect(() => {
    if (!selected) return;
    const dialog = document.getElementById(
      "training-setup",
    ) as HTMLDialogElement | null;
    const trigger = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      trigger?.focus({ preventScroll: true });
    };
  }, [selected]);
  function navigate(tab: string) {
    setTab(tab);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function choose(mode: ModeId) {
    setSelected(mode);
    setCount(mode === "section" ? 25 : 20);
    setError("");
  }
  async function start(override?: ModeId) {
    const mode = override || selected;
    if (!mode || busy) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/api/training/sessions", {
        mode,
        exam,
        tier,
        subject: mode === "mission" ? undefined : subject || undefined,
        topic: mode === "mission" ? undefined : topic || undefined,
        count,
        minutes,
      });
      router.push(`/play/session/${data.id}`);
    } catch (e) {
      setError(
        isAxiosError(e)
          ? e.response?.data?.error ||
              "Could not start the session. Please retry."
          : "Could not start training.",
      );
      setBusy(false);
    }
  }
  return (
    <div
      className={`training-page play-hub ${theme === "dark" ? "training-dark" : ""}`}
    >
      <header className="training-header" data-ui-chrome="header">
        <Link href="/play" className="training-brand">
          <span className="training-brand-icon">
            <Target size={22} />
          </span>
          <span>
            Play
            <span className="training-brand-caption">
              MEOW GURU / TRAINING STUDIO
            </span>
          </span>
        </Link>
        <label className="training-exam">
          <span className="sr-only">Target exam</span>
          <select
            value={exam}
            onChange={(e) => {
              setExam(e.target.value);
              setDashboard(null);
              setLoading(true);
              setError("");
              setSubject("");
              setTopic("");
            }}
          >
            <option value="ssc-cgl">SSC CGL</option>
            <option value="ssc-chsl">SSC CHSL</option>
            <option value="cat">CAT</option>
          </select>
        </label>
        <PlayNavigation mobile tab={tab} onChange={navigate} />
      </header>
      <div className="training-layout">
        <aside className="training-sidebar">
          <p className="training-kicker">YOUR TRAINING</p>
          <PlayNavigation tab={tab} onChange={navigate} />
          <div className="training-side-note">
            <Target size={24} />
            <strong>Train with intent.</strong>
            <p>Choose an objective. Measure the work. Come back stronger.</p>
          </div>
        </aside>
        <main className="training-main">
          <div className="training-heading">
            <div>
              <p className="training-kicker">
                {exam.replaceAll("-", " ").toUpperCase()} · YOUR NEXT SESSION
              </p>
              <h1>
                {tab === "Play"
                  ? "Choose your training."
                  : tab === "Train Me"
                    ? "Your daily mission."
                    : tab === "Mock"
                      ? "Train for the real paper."
                      : tab === "Review"
                        ? "Make it stick."
                        : "See what is improving."}
              </h1>
              <p>
                {tab === "Play"
                  ? "Build accuracy, speed and exam confidence."
                  : tab === "Train Me"
                    ? "A practical next step, shaped by your recent work."
                    : tab === "Mock"
                      ? "Previous papers and full mocks belong in the exam simulator."
                      : tab === "Review"
                        ? "Revisit mistakes and uncertain answers at the right time."
                        : "Evidence from your completed training sessions."}
              </p>
            </div>
            <span className="training-outline-label">
              <Sparkles size={14} aria-hidden="true" /> Your personal training
              space
            </span>
          </div>
          {error && !selected && (
            <div role="alert" className="training-error">
              {error}
              <button
                data-ui-button="secondary"
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            </div>
          )}
          {dashboard?.active.length ? (
            <div className="training-resume">
              <div>
                <strong>Continue your session</strong>
                <p>Progress saved · clock still running</p>
              </div>
              <Link
                data-ui-button="secondary"
                href={`/play/session/${dashboard.active[0].id}`}
              >
                Resume <ArrowRight size={16} />
              </Link>
            </div>
          ) : null}
          {tab === "Train Me" && (
            <section className="training-mission" aria-label="Daily mission">
              <div className="training-mission-copy">
                <span className="training-kicker">
                  <Sparkles size={15} /> YOUR DAILY MISSION
                </span>
                <h2>A plan built around your next step.</h2>
                <p>
                  {dashboard?.topics[0]
                    ? `Start with ${dashboard.topics[0].topic}, then build pace and review what is due.`
                    : "Start with a balanced session. Your answers will shape the next recommendation."}
                </p>
                <button
                  data-ui-button="primary"
                  disabled={busy || loading || !dashboard}
                  onClick={() => start("mission")}
                >
                  {busy ? "Building mission…" : "Start today’s mission"}{" "}
                  <ArrowRight size={17} />
                </button>
              </div>
              <div className="training-readiness">
                <div className="play-orbit" aria-hidden="true">
                  <Target size={46} strokeWidth={1.3} />
                </div>
                <span>PRACTICE READINESS</span>
                <strong>
                  {dashboard?.readiness ?? "—"}
                  <small>/100</small>
                </strong>
                <p>
                  {loading
                    ? "Loading your evidence…"
                    : dashboard?.readiness == null
                      ? "Complete 30 answers to establish a baseline."
                      : "Practice estimate · explore the factors in Analytics"}
                </p>
                <div className="training-meter">
                  <i style={{ width: `${dashboard?.readiness || 0}%` }} />
                </div>
              </div>
            </section>
          )}
          {tab === "Play" && (
            <>
              <PlayMissionShortcut
                loading={loading}
                available={!!dashboard}
                onOpen={() => navigate("Train Me")}
              />
              <PlayModeLibrary onChoose={choose} />
              <PlayPulse
                dashboard={dashboard}
                loading={loading}
                onChange={navigate}
              />
            </>
          )}
          {tab !== "Play" && (
            <TrainingInsights
              tab={tab}
              dashboard={dashboard}
              loading={loading}
              exam={exam}
              choose={(mode) => choose(mode)}
            />
          )}
        </main>
      </div>
      {selected && (
        <dialog
          id="training-setup"
          aria-labelledby="training-setup-title"
          aria-describedby="training-setup-description"
          className={`training-setup play-setup ${theme === "dark" ? "training-dark" : ""}`}
          onCancel={(e) => {
            if (busy) e.preventDefault();
            else setSelected(null);
          }}
        >
          <div className="training-panel-heading">
            <span className="training-kicker">SESSION BRIEF</span>
            <button
              data-ui-button="icon"
              aria-label="Close setup"
              disabled={busy}
              onClick={() => setSelected(null)}
            >
              <X size={20} />
            </button>
          </div>
          <h2 id="training-setup-title">
            {selectedMode?.title || "Smart review"}
          </h2>
          <p id="training-setup-description">
            {selectedMode?.detail ||
              "Work through questions that are due for spaced review."}
          </p>
          <div className="training-form">
            {["section", "gauntlet"].includes(selected) && exam !== "cat" && (
              <label>
                Tier
                <select value={tier} onChange={(e) => setTier(e.target.value)}>
                  <option value="1">Tier I</option>
                  <option value="2">Tier II</option>
                </select>
              </label>
            )}
            <label>
              Subject
              <select
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setTopic("");
                }}
              >
                <option value="">
                  {["section", "gauntlet"].includes(selected)
                    ? "Choose a section subject"
                    : "All available subjects"}
                </option>
                {dashboard?.subjects.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Topic
              <select value={topic} onChange={(e) => setTopic(e.target.value)}>
                <option value="">Balanced topic mix</option>
                {dashboard?.catalogTopics.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Questions
              <select
                value={count}
                onChange={(e) =>
                  setCount(
                    e.target.value === "full" ? "full" : Number(e.target.value),
                  )
                }
              >
                {[10, 20, 25, 50].map((n) => (
                  <option key={n} value={n}>
                    {n} questions
                  </option>
                ))}
                {["section", "gauntlet"].includes(selected) && (
                  <option value="full">Full configured section</option>
                )}
              </select>
            </label>
            {selected === "sprint" && (
              <label>
                Clock
                <select
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                >
                  {[5, 10, 15].map((n) => (
                    <option key={n} value={n}>
                      {n} minutes
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="training-brief-note">
            <strong>
              {["section", "gauntlet"].includes(selected)
                ? `Configured section scoring: +${exam === "cat" || tier === "2" ? 3 : 2} correct · −${exam === "cat" || tier === "2" ? 1 : 0.5} wrong · 0 left blank`
                : "Practice scoring: +1 correct · −0.25 wrong · 0 left blank"}
            </strong>
            <p>
              The clock continues if you leave. Bank availability may shorten
              the session. Full exam rules are available under Mock.
            </p>
          </div>
          {error && (
            <p className="training-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="training-start"
            data-ui-button="primary"
            disabled={
              busy ||
              loading ||
              (["section", "gauntlet"].includes(selected) && !subject)
            }
            onClick={() => start()}
          >
            {busy ? "Building your session…" : "Begin training"}
            <ArrowRight size={18} />
          </button>
        </dialog>
      )}
    </div>
  );
}
