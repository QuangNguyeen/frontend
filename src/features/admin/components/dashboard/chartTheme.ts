export function getChartColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    chart1: style.getPropertyValue('--chart-1').trim(),
    chart2: style.getPropertyValue('--chart-2').trim(),
    chart3: style.getPropertyValue('--chart-3').trim(),
    chart4: style.getPropertyValue('--chart-4').trim(),
    chart5: style.getPropertyValue('--chart-5').trim(),
    foreground: style.getPropertyValue('--foreground').trim(),
    mutedForeground: style.getPropertyValue('--muted-foreground').trim(),
    border: style.getPropertyValue('--border').trim(),
    card: style.getPropertyValue('--card').trim(),
  };
}

export const CHART_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 };
