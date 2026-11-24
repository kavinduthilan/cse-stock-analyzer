"use client";
import { Area, ComposedChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

const sample = [
  { t: 1789583400000, p: 202.5 },
  { t: 1789669800000, p: 203 },
  { t: 1789929000000, p: 202.5 },
  { t: 1790015400000, p: 202.75 },
];

export default function ChartTest() {
  return (
    <div style={{ width: "100%", height: 288, border: "1px solid red" }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={sample}>
          <XAxis dataKey="t" />
          <YAxis domain={["auto", "auto"]} />
          <Area dataKey="p" stroke="#0e6e73" fill="#0e6e73" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}