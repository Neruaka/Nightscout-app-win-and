import type { TimeInRangeStats } from "@nightscout/shared-types";
import type { Translator } from "../../i18n/translations";

interface TimeInRangeSectionProps {
  stats: TimeInRangeStats | null;
  t: Translator;
}

export function TimeInRangeSection(props: TimeInRangeSectionProps) {
  return (
    <section className="panel">
      <h2>{props.t("tirTitle")}</h2>
      {props.stats ? (
        <div className="grid grid--tir">
          {[props.stats.day, props.stats.week, props.stats.month].map((bucket) => (
            <article className="metric-card" key={bucket.label}>
              <p>{bucket.label.toUpperCase()}</p>
              <h3>
                {bucket.inRangePct}% {props.t("inRange")}
              </h3>
              <p>
                {props.t("low")} {bucket.lowPct}% / {props.t("high")} {bucket.highPct}%
              </p>
              <p>Avg {bucket.avgGL === null ? "--" : `${bucket.avgGL.toFixed(2)} g/L`}</p>
              <p>
                {bucket.count} {props.t("points")}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">{props.t("noTir")}</p>
      )}
    </section>
  );
}
