import type { Translator } from "../../i18n/translations";
import type { HealthScoreCardData } from "../../lib/insights";

interface HealthScoreCardProps {
  score: HealthScoreCardData | null;
  t: Translator;
}

function Metric(props: { label: string; value: string }) {
  return (
    <article className="metric-card">
      <p>{props.label}</p>
      <h3>{props.value}</h3>
    </article>
  );
}

export function HealthScoreCard(props: HealthScoreCardProps) {
  return (
    <section className="panel">
      <h2>{props.t("healthScoreTitle")}</h2>
      {props.score ? (
        <div className="grid grid--health">
          <Metric label={props.t("overallScore")} value={`${props.score.overall}/100`} />
          <Metric label={props.t("tirScore")} value={`${props.score.tirScore}/100`} />
          <Metric
            label={props.t("variabilityScore")}
            value={`${props.score.variabilityScore}/100`}
          />
          <Metric label={props.t("hypoBurdenScore")} value={`${props.score.hypoScore}/100`} />
          <Metric
            label={props.t("trendStabilityScore")}
            value={`${props.score.stabilityScore}/100`}
          />
          <Metric label={props.t("cvMetric")} value={`${props.score.cvPct}%`} />
          <Metric label={props.t("inRangeMetric")} value={`${props.score.inRangePct}%`} />
          <Metric label={props.t("lowMetric")} value={`${props.score.lowPct}%`} />
        </div>
      ) : (
        <p className="empty-state">{props.t("noHealthScore")}</p>
      )}
    </section>
  );
}
