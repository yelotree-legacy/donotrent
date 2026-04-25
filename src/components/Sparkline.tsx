// Tiny SVG sparkline. Server-renderable, no JS, no chart libraries.
// Pass a series of numbers; renders a smoothed line + filled area.

export function Sparkline({
  values,
  width = 120,
  height = 36,
  color = "rgb(220 38 38)",
  fillOpacity = 0.18,
  className = "",
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  fillOpacity?: number;
  className?: string;
}) {
  if (!values || values.length === 0) {
    return <div style={{ width, height }} className={className} />;
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);

  const stepX = values.length > 1 ? width / (values.length - 1) : width;
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return [x, y] as const;
  });

  const linePath = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${width.toFixed(1)},${height} L0,${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden="true">
      <path d={areaPath} fill={color} fillOpacity={fillOpacity} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Last-point dot */}
      {points.length > 0 && (
        <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={2.5} fill={color} />
      )}
    </svg>
  );
}
