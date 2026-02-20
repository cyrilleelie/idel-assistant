export const theme = {
  primary: "#2563EB",
  primaryDark: "#1E40AF",
  primaryLight: "#60A5FA",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  text: "#1E293B",
  textSecondary: "#64748B",
  border: "#E2E8F0",
  error: "#DC2626",
  success: "#16A34A",
  warning: "#F59E0B",
};

const SECTOR_COLORS = [
  "#3B82F6", // blue
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#F97316", // orange
];

export function getSectorColor(index: number): string {
  return SECTOR_COLORS[index % SECTOR_COLORS.length];
}
