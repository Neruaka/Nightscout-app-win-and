import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { DisplayUnits, MealEntry } from "@nightscout/shared-types";
import type { Translator } from "../../i18n/translations";
import { formatDateTick, formatTimestamp } from "../../lib/format";
import type { InferredMealEvent } from "../../lib/insights";

interface GlucoseChartPoint {
  ts: number;
  sgv: number;
  raw: number;
}

interface GlucoseChartCardProps {
  chartData: GlucoseChartPoint[];
  meals: MealEntry[];
  inferredMeals: InferredMealEvent[];
  trendArrow: string;
  units: DisplayUnits;
  t: Translator;
}

export function GlucoseChartCard(props: GlucoseChartCardProps) {
  const validMeals = props.meals
    .map((meal) => ({
      ...meal,
      at: Date.parse(meal.eatenAt)
    }))
    .filter((meal) => Number.isFinite(meal.at));

  const lowThreshold = props.units === "mg/dL" ? 80 : 4.4;
  const midHighThreshold = props.units === "mg/dL" ? 130 : 7.2;
  const highThreshold = props.units === "mg/dL" ? 180 : 10;
  const maxSeriesValue = Math.max(
    ...props.chartData.map((point) => point.sgv),
    highThreshold
  );

  return (
    <section className="panel chart-panel">
      <div className="chart-head">
        <h2>{props.t("chartTitle")}</h2>
        <div className="trend-chip">
          <span>{props.t("trendNow")}</span>
          <strong>{props.trendArrow}</strong>
        </div>
      </div>
      {props.chartData.length === 0 ? (
        <p className="empty-state">{props.t("noValues")}</p>
      ) : (
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={props.chartData}>
            <ReferenceArea y1={0} y2={lowThreshold} fill="#a33f43" fillOpacity={0.14} />
            <ReferenceArea
              y1={midHighThreshold}
              y2={highThreshold}
              fill="#c27f34"
              fillOpacity={0.12}
            />
            <ReferenceArea
              y1={highThreshold}
              y2={maxSeriesValue + (props.units === "mg/dL" ? 20 : 1)}
              fill="#a33f43"
              fillOpacity={0.15}
            />
            <CartesianGrid strokeDasharray="4 8" stroke="#355b73" opacity={0.35} />
            <XAxis
              dataKey="ts"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tick={{ fill: "#cde8ff", fontSize: 12 }}
              tickFormatter={(value) => formatDateTick(Number(value))}
            />
            <YAxis tick={{ fill: "#cde8ff", fontSize: 12 }} />
            <Tooltip
              labelFormatter={(value) => formatTimestamp(new Date(Number(value)).toISOString())}
              formatter={(value) => [`${value}`, props.units]}
              contentStyle={{
                background: "#0f1c2a",
                border: "1px solid #2f5572",
                borderRadius: 10,
                color: "#dbf3ff"
              }}
            />
            {validMeals.map((meal) => (
              <ReferenceLine
                key={meal.id}
                x={meal.at}
                stroke="#ffd36a"
                strokeWidth={2}
                strokeDasharray="4 4"
                label={{
                  position: "insideTopLeft",
                  value: `${meal.name} (${meal.carbsGrams}g)`,
                  fill: "#ffd36a",
                  fontSize: 10
                }}
              />
            ))}
            {props.inferredMeals.map((meal) => (
              <ReferenceLine
                key={meal.id}
                x={Date.parse(meal.eatenAt)}
                stroke="#dd5f6e"
                strokeDasharray="2 4"
                label={{
                  position: "insideTopRight",
                  value: `${props.t("inferredMeal")} (+${meal.riseMgdl})`,
                  fill: "#dd5f6e",
                  fontSize: 10
                }}
              />
            ))}
            <Line
              type="monotone"
              dataKey="sgv"
              stroke="#68e0ff"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
