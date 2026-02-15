import type { InsulinAdviceResult } from "@nightscout/shared-types";
import type { Translator } from "../i18n/translations";
import type { SensitivityInsight } from "../lib/insights";

interface BolusPageProps {
  carbsInput: string;
  onCarbsInput: (value: string) => void;
  glucoseGLInput: string;
  onGlucoseGLInput: (value: string) => void;
  mealTimeInput: string;
  onMealTimeInput: (value: string) => void;
  liveGlucoseGL: number | null;
  iobUnits: number;
  cobGrams: number;
  advisor: InsulinAdviceResult | null;
  advisorMessage: string | null;
  sensitivity: SensitivityInsight;
  onUseLiveGlucose: () => void;
  t: Translator;
}

function MetricCard(props: { label: string; value: string }) {
  return (
    <article className="metric-card">
      <p>{props.label}</p>
      <h3>{props.value}</h3>
    </article>
  );
}

function getStatus(
  advice: InsulinAdviceResult | null,
  t: Translator
): { label: string; className: string } {
  const status = advice?.glucoseStatus ?? null;
  if (status === "high") {
    return { label: t("aboveTarget"), className: "status-chip status-chip--high" };
  }
  if (status === "low") {
    return { label: t("belowTarget"), className: "status-chip status-chip--low" };
  }
  if (status === "in-range") {
    return { label: t("inTargetRange"), className: "status-chip status-chip--ok" };
  }
  return { label: t("awaitingInput"), className: "status-chip" };
}

export function BolusPage(props: BolusPageProps) {
  const status = getStatus(props.advisor, props.t);
  const confidenceLabel =
    props.sensitivity.confidence === "high"
      ? props.t("confidence_high")
      : props.sensitivity.confidence === "medium"
        ? props.t("confidence_medium")
        : props.t("confidence_low");

  return (
    <section className="panel insulin-panel">
      <div className="insulin-head">
        <h2>{props.t("insulinAdvisorTitle")}</h2>
        <span className={status.className}>{status.label}</span>
      </div>
      <p className="insulin-disclaimer">{props.t("advisorDisclaimer")}</p>

      <div className="insulin-form">
        <label>
          {props.t("carbsGrams")}
          <input
            type="text"
            inputMode="decimal"
            value={props.carbsInput}
            onChange={(event) => props.onCarbsInput(event.target.value)}
            placeholder="45"
          />
        </label>

        <label>
          {props.t("currentGlucoseGL")}
          <input
            type="text"
            inputMode="decimal"
            value={props.glucoseGLInput}
            onChange={(event) => props.onGlucoseGLInput(event.target.value)}
            placeholder="1.12"
          />
        </label>

        <label>
          {props.t("mealTime")}
          <input
            type="time"
            value={props.mealTimeInput}
            onChange={(event) => props.onMealTimeInput(event.target.value)}
          />
        </label>
      </div>

      <div className="insulin-actions">
        <button
          type="button"
          className="secondary"
          disabled={props.liveGlucoseGL === null}
          onClick={props.onUseLiveGlucose}
        >
          {props.t("useLiveGlucose")}
        </button>
        <p className="insulin-live">
          {props.t("liveGlucose")}:{" "}
          {props.liveGlucoseGL === null ? "--" : `${props.liveGlucoseGL.toFixed(2)} g/L`} / IOB{" "}
          {props.iobUnits.toFixed(2)} U / COB {props.cobGrams.toFixed(1)} g
        </p>
      </div>

      {props.advisorMessage ? <p className="warn-banner">{props.advisorMessage}</p> : null}

      {props.advisor ? (
        <>
          {props.advisor.glucoseStatus === "low" ? (
            <p className="error-banner">{props.t("lowGlucoseWarning")}</p>
          ) : null}

          <section className="grid grid--insulin">
            <MetricCard
              label={props.t("carbRatioUsed")}
              value={`1 U / ${props.advisor.ratioGramsPerUnit} g`}
            />
            <MetricCard
              label={props.t("mealBolus")}
              value={`${props.advisor.carbBolusUnits} U`}
            />
            <MetricCard
              label={props.t("correctionBolus")}
              value={`${props.advisor.correctionUnits} U`}
            />
            <MetricCard
              label={props.t("adjustedTotal")}
              value={`${props.advisor.adjustedTotalUnits} U`}
            />
            <MetricCard
              label={props.t("roundedDose")}
              value={`${props.advisor.roundedHalfUnitDose} U`}
            />
          </section>

          <div className="insulin-notes">
            {props.advisor.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
        </>
      ) : null}

      <section className="panel panel--sub">
        <h3>{props.t("sensitivityAssistantTitle")}</h3>
        {props.sensitivity.sampleCount === 0 ? (
          <p className="empty-state">{props.t("sensitivityNoData")}</p>
        ) : (
          <div className="grid grid--sensitivity">
            <MetricCard
              label={props.t("sampleCount")}
              value={String(props.sensitivity.sampleCount)}
            />
            <MetricCard
              label={props.t("avgDropPerUnit")}
              value={`${props.sensitivity.averageDropPerUnitGL ?? "--"} g/L`}
            />
            <MetricCard
              label={props.t("suggestedFactor")}
              value={`${props.sensitivity.suggestedCorrectionFactorGL ?? "--"} g/L/U`}
            />
            <MetricCard
              label={props.t("confidence")}
              value={confidenceLabel}
            />
          </div>
        )}
      </section>
    </section>
  );
}
