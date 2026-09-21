import { type Confidence } from "../training-types";

interface TrainingConfidenceProps {
  confidence: Confidence | null;
  setConfidence: (c: Confidence | null) => void;
  busy: boolean;
}

export function TrainingConfidence({ confidence, setConfidence, busy }: TrainingConfidenceProps) {
  return (
    <fieldset className="training-confidence">
      <legend>
        Confidence rating{" "}
        <span className="training-confidence-hint">Optional</span>
      </legend>
      <div className="training-confidence-chips">
        {(["sure", "unsure", "guess"] as Confidence[]).map((c) => {
          const isSelected = confidence === c;
          return (
            <button
              key={c}
              data-ui-button="state"
              type="button"
              className={`training-conf-chip conf-${c} ${isSelected ? "active" : ""}`}
              aria-pressed={isSelected}
              onClick={() =>
                setConfidence(confidence === c ? null : c)
              }
              disabled={busy}
            >
              <span className="training-conf-dot" />
              {c === "sure"
                ? "Sure"
                : c === "unsure"
                  ? "Unsure"
                  : "Guess"}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
