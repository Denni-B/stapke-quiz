export const KAHOOT_OPTION_COLORS = [
  { bg: "bg-red-500", hover: "hover:bg-red-600", ring: "ring-red-500" },
  { bg: "bg-blue-500", hover: "hover:bg-blue-600", ring: "ring-blue-500" },
  { bg: "bg-yellow-400", hover: "hover:bg-yellow-500", ring: "ring-yellow-400" },
  { bg: "bg-green-500", hover: "hover:bg-green-600", ring: "ring-green-500" },
] as const;

export function getKahootColor(index: number) {
  return KAHOOT_OPTION_COLORS[index % KAHOOT_OPTION_COLORS.length];
}
