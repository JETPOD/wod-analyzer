// Radar superposable pour comparer 1 à 4 WODs (capacités + filières)
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  Legend,
} from "recharts";
import type { WodAnalysis } from "@/lib/wodAnalyzer";

export interface RadarSeries {
  label: string;
  analysis: WodAnalysis;
  color: string;
}

const AXES: { key: string; label: string; from: "energetics" | "capacities"; field: string }[] = [
  { key: "atp", label: "ATP-PCr", from: "energetics", field: "atp_pcr" },
  { key: "gly", label: "Glyco", from: "energetics", field: "glycolytic" },
  { key: "oxy", label: "Oxydat.", from: "energetics", field: "oxidative" },
  { key: "fmax", label: "Force max", from: "capacities", field: "force_max" },
  { key: "pui", label: "Puissance", from: "capacities", field: "puissance" },
  { key: "ef", label: "End. force", from: "capacities", field: "endurance_force" },
  { key: "vo2", label: "VO2max", from: "capacities", field: "vo2max" },
  { key: "lac", label: "Lactique", from: "capacities", field: "lactique" },
  { key: "gain", label: "Gainage", from: "capacities", field: "gainage" },
  { key: "ski", label: "Skill", from: "capacities", field: "skill" },
];

export function RadarCompare({
  series,
  height = 380,
  domId,
}: {
  series: RadarSeries[];
  height?: number;
  domId?: string;
}) {
  const data = AXES.map((ax) => {
    const row: Record<string, string | number> = { axis: ax.label };
    series.forEach((s, i) => {
      const src = ax.from === "energetics" ? s.analysis.energetics : s.analysis.capacities;
      row[`s${i}`] = (src as Record<string, number>)[ax.field] ?? 0;
    });
    return row;
  });

  return (
    <div id={domId} style={{ width: "100%", height }} className="bg-card">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="74%">
          <PolarGrid stroke="hsl(220 13% 22%)" />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fill: "hsl(220 9% 75%)", fontSize: 11 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: "hsl(220 9% 50%)", fontSize: 10 }}
            stroke="hsl(220 13% 22%)"
            tickCount={5}
          />
          {series.map((s, i) => (
            <Radar
              key={i}
              name={s.label}
              dataKey={`s${i}`}
              stroke={s.color}
              fill={s.color}
              fillOpacity={0.25}
              strokeWidth={2}
            />
          ))}
          <Tooltip
            contentStyle={{
              background: "hsl(220 13% 12%)",
              border: "1px solid hsl(220 10% 20%)",
              borderRadius: 10,
              fontSize: 12,
            }}
            labelStyle={{ color: "hsl(210 20% 96%)" }}
            formatter={(v: number, n: string) => [`${Math.round(v)}%`, n]}
          />
          {series.length > 1 && (
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              iconType="circle"
            />
          )}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export const COMPARE_COLORS = ["#FF6B35", "#22D3EE", "#7CFC80", "#C084FC"];
