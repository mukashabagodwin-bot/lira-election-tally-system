function wrapLabel(ctx, text, maxWidth) {
  const words = String(text || '').split(' ');
  const lines = [];
  let line = '';

  words.forEach((word) => {
    const next = line ? line + ' ' + word : word;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  });

  if (line) lines.push(line);
  return lines.slice(0, 2).map((item) => item.length > 24 ? item.slice(0, 21) + '...' : item);
}

function drawBarChart(canvas, points, valueKey, labelKey, color, emptyMessage) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  if (!points || points.length === 0) {
    ctx.fillStyle = '#667085';
    ctx.font = '16px Arial';
    ctx.fillText(emptyMessage || 'No verified data yet', 24, 44);
    return;
  }

  const max = Math.max(...points.map((point) => Number(point[valueKey] || 0)), 1);
  const margin = { top: 30, right: 24, bottom: 92, left: 52 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const slotWidth = plotWidth / points.length;
  const barWidth = Math.max(28, Math.min(130, slotWidth * 0.78));

  ctx.strokeStyle = '#d9dee7';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, margin.top + plotHeight);
  ctx.lineTo(width - margin.right, margin.top + plotHeight);
  ctx.stroke();

  points.forEach((point, index) => {
    const value = Number(point[valueKey] || 0);
    const slotX = margin.left + index * slotWidth;
    const x = slotX + (slotWidth - barWidth) / 2;
    const barHeight = (value / max) * plotHeight;
    const y = margin.top + plotHeight - barHeight;

    ctx.fillStyle = color;
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = '#475467';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(String(value), x + barWidth / 2, Math.max(16, y - 8));

    const labelLines = wrapLabel(ctx, point[labelKey], Math.max(72, slotWidth - 12));
    ctx.fillStyle = '#344054';
    ctx.font = '11px Arial';
    labelLines.forEach((line, lineIndex) => {
      ctx.fillText(line, slotX + slotWidth / 2, margin.top + plotHeight + 24 + lineIndex * 14);
    });
  });

  ctx.textAlign = 'left';
}

function readPoints(canvas) {
  if (!canvas) return [];
  try {
    return JSON.parse(canvas.dataset.points || '[]');
  } catch (error) {
    return [];
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const candidateCanvas = document.getElementById('candidateChart');
  const turnoutCanvas = document.getElementById('turnoutChart');
  const rejectedReasonCanvas = document.getElementById('rejectedReasonChart');
  const batchStatusCanvas = document.getElementById('batchStatusChart');
  drawBarChart(candidateCanvas, readPoints(candidateCanvas), 'votes', 'name', '#2457a6', 'No verified candidate data yet');
  drawBarChart(turnoutCanvas, readPoints(turnoutCanvas), 'turnout', 'station', '#0f766e', 'No verified turnout data yet');
  drawBarChart(rejectedReasonCanvas, readPoints(rejectedReasonCanvas), 'count', 'reason', '#b42318', 'No rejected votes recorded');
  drawBarChart(batchStatusCanvas, readPoints(batchStatusCanvas), 'count', 'status', '#a15c07', 'No batches recorded');
});
