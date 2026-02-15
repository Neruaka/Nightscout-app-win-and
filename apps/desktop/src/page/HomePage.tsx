import type {
  DashboardPayload,
  DisplayUnits,
  IobCobSnapshot,
  MealEntry,
  TimeInRangeStats
} from "@nightscout/shared-types";
import type { Translator } from "../i18n/translations";
import { mapTrend } from "../lib/format";
import type {
  HealthScoreCardData,
  InferredMealEvent
} from "../lib/insights";
import { GlucoseChartCard } from "../components/dashboard/GlucoseChartCard";
import { HealthScoreCard } from "../components/dashboard/HealthScoreCard";
import { MetricsGrid } from "../components/dashboard/MetricsGrid";
import { TimeInRangeSection } from "../components/dashboard/TimeInRangeSection";

interface GlucoseChartPoint {
  ts: number;
  sgv: number;
  raw: number;
}

interface HomePageProps {
  dashboard: DashboardPayload | null;
  units: DisplayUnits;
  chartData: GlucoseChartPoint[];
  meals24h: MealEntry[];
  inferredMeals: InferredMealEvent[];
  iobCob: IobCobSnapshot;
  tirStats: TimeInRangeStats | null;
  healthScore: HealthScoreCardData | null;
  t: Translator;
}

export function HomePage(props: HomePageProps) {
  return (
    <>
      <GlucoseChartCard
        chartData={props.chartData}
        meals={props.meals24h}
        inferredMeals={props.inferredMeals}
        trendArrow={mapTrend(props.dashboard?.summary.direction ?? null)}
        units={props.units}
        t={props.t}
      />
      <MetricsGrid
        dashboard={props.dashboard}
        units={props.units}
        iobCob={props.iobCob}
        t={props.t}
      />
      <TimeInRangeSection stats={props.tirStats} t={props.t} />
      <HealthScoreCard score={props.healthScore} t={props.t} />
    </>
  );
}
