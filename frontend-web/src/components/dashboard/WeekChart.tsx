import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Placeholder data for MVP (no /tournees/stats endpoint yet)
const placeholderData = [
  { day: "Lun", km: 32 },
  { day: "Mar", km: 28 },
  { day: "Mer", km: 15 },
  { day: "Jeu", km: 35 },
  { day: "Ven", km: 22 },
  { day: "Sam", km: 18 },
];

export function WeekChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kilometres / jour</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={placeholderData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" fontSize={12} />
            <YAxis fontSize={12} unit=" km" />
            <Tooltip formatter={(value: number) => [`${value} km`, "Distance"]} />
            <Bar
              dataKey="km"
              fill="oklch(0.546 0.245 262.881)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
