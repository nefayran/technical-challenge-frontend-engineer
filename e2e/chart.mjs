// Tiny SVG chart generator for the perf report — no charting library, the
// output is committed to docs/perf/ and renders directly on GitHub.

const STYLE = {
  bg: "#0e1013",
  panel: "#14161b",
  grid: "#22252e",
  text: "#9096a6",
  textBright: "#d1d3d9",
  bar: ["#8b6ce0", "#d64d8e", "#5b8def", "#d9a13d"],
  budget: "#4caf50",
  font: "13px 'Helvetica Neue', Arial, sans-serif",
};

function esc(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

// groups: [{ label, values: [{ name, value }] }], budget: horizontal line (ms)
export function barChart({ title, groups, budget, unit = "ms", width = 760, height = 360 }) {
  const margin = { top: 56, right: 24, bottom: 56, left: 56 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const seriesNames = groups[0].values.map((v) => v.name);
  const maxValue = Math.max(
    budget ?? 0,
    ...groups.flatMap((g) => g.values.map((v) => v.value)),
  ) * 1.15;

  const y = (v) => margin.top + plotH - (v / maxValue) * plotH;
  const groupW = plotW / groups.length;
  const barW = Math.min(48, (groupW * 0.7) / seriesNames.length);

  let bars = "";
  groups.forEach((group, gi) => {
    const cx = margin.left + groupW * gi + groupW / 2;
    const total = barW * seriesNames.length;
    group.values.forEach((v, si) => {
      const x = cx - total / 2 + si * barW;
      bars += `<rect x="${x.toFixed(1)}" y="${y(v.value).toFixed(1)}" width="${(barW - 4).toFixed(1)}" height="${(margin.top + plotH - y(v.value)).toFixed(1)}" fill="${STYLE.bar[si % STYLE.bar.length]}"/>`;
      bars += `<text x="${(x + (barW - 4) / 2).toFixed(1)}" y="${(y(v.value) - 6).toFixed(1)}" fill="${STYLE.textBright}" font="${STYLE.font}" font-size="11" text-anchor="middle">${v.value.toFixed(1)}</text>`;
    });
    bars += `<text x="${cx.toFixed(1)}" y="${height - 28}" fill="${STYLE.text}" font="${STYLE.font}" text-anchor="middle">${esc(group.label)}</text>`;
  });

  let gridLines = "";
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const value = (maxValue / steps) * i;
    const gy = y(value);
    gridLines += `<line x1="${margin.left}" y1="${gy.toFixed(1)}" x2="${width - margin.right}" y2="${gy.toFixed(1)}" stroke="${STYLE.grid}"/>`;
    gridLines += `<text x="${margin.left - 8}" y="${(gy + 4).toFixed(1)}" fill="${STYLE.text}" font="${STYLE.font}" font-size="11" text-anchor="end">${value.toFixed(0)}</text>`;
  }

  let budgetLine = "";
  if (budget !== undefined) {
    const by = y(budget);
    budgetLine =
      `<line x1="${margin.left}" y1="${by.toFixed(1)}" x2="${width - margin.right}" y2="${by.toFixed(1)}" stroke="${STYLE.budget}" stroke-dasharray="6 4"/>` +
      `<text x="${margin.left + 6}" y="${(by - 6).toFixed(1)}" fill="${STYLE.budget}" font="${STYLE.font}" font-size="11" text-anchor="start">60fps budget (${budget}${unit})</text>`;
  }

  const legend = seriesNames
    .map(
      (name, i) =>
        `<rect x="${margin.left + i * 110}" y="${height - 16}" width="10" height="10" fill="${STYLE.bar[i % STYLE.bar.length]}"/>` +
        `<text x="${margin.left + i * 110 + 16}" y="${height - 7}" fill="${STYLE.text}" font="${STYLE.font}" font-size="11">${esc(name)}</text>`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="${STYLE.bg}"/>
<text x="${margin.left}" y="28" fill="${STYLE.textBright}" font="${STYLE.font}" font-size="15">${esc(title)}</text>
<text x="16" y="${(margin.top + plotH / 2).toFixed(1)}" fill="${STYLE.text}" font="${STYLE.font}" font-size="11" transform="rotate(-90 16 ${(margin.top + plotH / 2).toFixed(1)})" text-anchor="middle">${unit}</text>
${gridLines}${budgetLine}${bars}${legend}
</svg>`;
}

// series: [{ name, points: number[] }] — frame-time traces
export function lineChart({ title, series, budget, unit = "ms", width = 760, height = 300 }) {
  const margin = { top: 56, right: 24, bottom: 40, left: 56 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const maxValue = Math.max(budget ?? 0, ...series.flatMap((s) => s.points)) * 1.15;
  const maxLen = Math.max(...series.map((s) => s.points.length));

  const x = (i) => margin.left + (i / (maxLen - 1)) * plotW;
  const y = (v) => margin.top + plotH - (v / maxValue) * plotH;

  let gridLines = "";
  for (let i = 0; i <= 4; i++) {
    const value = (maxValue / 4) * i;
    const gy = y(value);
    gridLines += `<line x1="${margin.left}" y1="${gy.toFixed(1)}" x2="${width - margin.right}" y2="${gy.toFixed(1)}" stroke="${STYLE.grid}"/>`;
    gridLines += `<text x="${margin.left - 8}" y="${(gy + 4).toFixed(1)}" fill="${STYLE.text}" font="${STYLE.font}" font-size="11" text-anchor="end">${value.toFixed(0)}</text>`;
  }

  const paths = series
    .map((s, si) => {
      const d = s.points
        .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
        .join("");
      return `<path d="${d}" fill="none" stroke="${STYLE.bar[si % STYLE.bar.length]}" stroke-width="1.5"/>`;
    })
    .join("");

  let budgetLine = "";
  if (budget !== undefined) {
    const by = y(budget);
    budgetLine =
      `<line x1="${margin.left}" y1="${by.toFixed(1)}" x2="${width - margin.right}" y2="${by.toFixed(1)}" stroke="${STYLE.budget}" stroke-dasharray="6 4"/>` +
      `<text x="${margin.left + 6}" y="${(by - 6).toFixed(1)}" fill="${STYLE.budget}" font="${STYLE.font}" font-size="11" text-anchor="start">60fps budget (${budget}${unit})</text>`;
  }

  const legend = series
    .map(
      (s, i) =>
        `<rect x="${margin.left + i * 220}" y="${height - 16}" width="10" height="10" fill="${STYLE.bar[i % STYLE.bar.length]}"/>` +
        `<text x="${margin.left + i * 220 + 16}" y="${height - 7}" fill="${STYLE.text}" font="${STYLE.font}" font-size="11">${esc(s.name)}</text>`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="${STYLE.bg}"/>
<text x="${margin.left}" y="28" fill="${STYLE.textBright}" font="${STYLE.font}" font-size="15">${esc(title)}</text>
<text x="16" y="${(margin.top + plotH / 2).toFixed(1)}" fill="${STYLE.text}" font="${STYLE.font}" font-size="11" transform="rotate(-90 16 ${(margin.top + plotH / 2).toFixed(1)})" text-anchor="middle">${unit}</text>
${gridLines}${budgetLine}${paths}${legend}
</svg>`;
}
