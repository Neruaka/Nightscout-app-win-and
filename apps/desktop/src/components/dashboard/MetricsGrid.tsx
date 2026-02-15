import type { DashboardPayload, DisplayUnits, IobCobSnapshot } from "@nightscout/shared-types";
import type { Translator } from "../../i18n/translations";
import { formatDelta, formatGlucose, formatTimestamp, mapTrend } from "../../lib/format";

interface MetricsGridProps {
  dashboard: DashboardPayload | null;
  units: DisplayUnits;
  iobCob: IobCobSnapshot;
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

export function MetricsGrid(props: MetricsGridProps) {
  return (
    <section className="grid grid--stats">
      <MetricCard
        label={props.t("current")}
        value={formatGlucose(props.dashboard?.summary.current ?? null, props.units)}
      />
      <MetricCard
        label={props.t("delta")}
        value={formatDelta(props.dashboard?.summary.delta ?? null, props.units)}
      />
      <MetricCard
        label={props.t("trend")}
        value={mapTrend(props.dashboard?.summary.direction ?? null)}
      />
      <MetricCard
        label={props.t("updatedAt")}
        value={formatTimestamp(props.dashboard?.summary.updatedAt ?? null)}
      />
      <MetricCard label={props.t("iob")} value={`${props.iobCob.iobUnits.toFixed(2)} U`} />
      <MetricCard label={props.t("cob")} value={`${props.iobCob.cobGrams.toFixed(1)} g`} />
      <MetricCard
        label={props.t("steps24h")}
        value={String(props.dashboard?.healthConnect?.stepsLast24h ?? "--")}
      />
      <MetricCard
        label={props.t("weight")}
        value={
          props.dashboard?.healthConnect?.weightKgLatest === null ||
          props.dashboard?.healthConnect?.weightKgLatest === undefined
            ? "--"
            : `${props.dashboard.healthConnect.weightKgLatest} kg`
        }
      />
    </section>
  );
}
