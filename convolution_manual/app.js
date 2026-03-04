"use strict";

/*
 * Convolution Demo — Click Increment Version
 * Styled to match classic Swing applet look:
 *   - Yellow panels
 *   - Times New Roman font
 *   - Blue axes
 *   - Black curves
 */

// ================================
// Constants
// ================================
const x_min = -3, x_max = 3;
const PANELS = 4;
const panelGap = 8;
const bottomPad = 6;

const BASE_W = 280;
const BASE_H = 440;

const N = 512;
const delta_t = (x_max - x_min) / (N - 1);

const fontPx = 18;
const tickLenPx = 6;
const x_space = 60;
const y_space = 14;

// ================================
// State
// ================================
let convMode = false;
let n = 0;
let tNow = 0;

const tau = new Float64Array(N);
const x_tau = new Float64Array(N);
const h_tau = new Float64Array(N);
const xh_tau = new Float64Array(N);
const y_out = new Float64Array(N);
let offset = 0;

// ================================
// Initialization
// ================================
function initTime() {
  for (let i = 0; i < N; i++) {
    tau[i] = x_min + i * delta_t;
    y_out[i] = 0;
  }

  let best = Infinity;
  for (let i = 0; i < N; i++) {
    const a = Math.abs(tau[i]);
    if (a < best) { best = a; offset = i; }
  }
}

function buildX() {
  for (let i = 0; i < N; i++) {
    const t = tau[i];
    if (t >= 0 && t < 1) x_tau[i] = 1;
    else if (t >= 1 && t < 2) x_tau[i] = -1;
    else x_tau[i] = 0;
  }
}

function buildH() {
  for (let i = 0; i < N; i++) {
    const t = tau[i];
    h_tau[i] = (t >= 0 && t < 1) ? 1 : 0;
  }
}

function buildHShifted(tNow) {
  for (let i = 0; i < N; i++) {
    const arg = tNow - tau[i];
    h_tau[i] = (arg >= 0 && arg < 1) ? 1 : 0;
  }
}

function elemMult() {
  for (let i = 0; i < N; i++)
    xh_tau[i] = x_tau[i] * h_tau[i];
}

function integrate() {
  let s = 0;
  for (let i = 0; i < N; i++)
    s += xh_tau[i];
  return s * delta_t;
}

function round2(x) {
  return Math.round(x * 100) / 100;
}

// ================================
// Canvas helpers
// ================================
function fitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const availW = window.innerWidth;
  const availH = Math.floor(window.innerHeight * 0.9);

  const s = Math.min(availW / BASE_W, availH / BASE_H);

  const cssW = Math.floor(BASE_W * s);
  const cssH = Math.floor(BASE_H * s);

  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;

  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);

  return { dpr, cssW, cssH };
}

function makePanelRect(cssH, p) {
  const totalGap = panelGap * (PANELS - 1);
  const panelH = (cssH - totalGap - bottomPad) / PANELS;
  const top = p * (panelH + panelGap);
  const bottom = top + panelH;
  return { top, bottom };
}

function makeMapping(cssW, rect, y_min, y_max) {
  const plotLeft = x_space;
  const plotRight = cssW - x_space;
  const plotTop = rect.top + y_space;
  const plotBottom = rect.bottom - y_space;

  const sx = (plotRight - plotLeft) / (x_max - x_min);
  const sy = (plotBottom - plotTop) / (y_max - y_min);

  function dataToPixel(x, y) {
    const px = plotLeft + (x - x_min) * sx;
    const py = plotBottom - (y - y_min) * sy;
    return [px, py];
  }

  return { plotLeft, plotRight, plotTop, plotBottom, dataToPixel };
}

// ================================
// Drawing
// ================================
function drawAxes(ctx, map, y_min, y_max) {
  ctx.save();
  ctx.strokeStyle = "blue";
  ctx.lineWidth = 1;

  const [x0, y0] = map.dataToPixel(x_min, y_min);
  const [x1, y1] = map.dataToPixel(x_min, y_max);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();

  if (y_min <= 0 && 0 <= y_max) {
    const [xa0, ya0] = map.dataToPixel(x_min, 0);
    const [xa1, ya1] = map.dataToPixel(x_max, 0);
    ctx.beginPath();
    ctx.moveTo(xa0, ya0);
    ctx.lineTo(xa1, ya1);
    ctx.stroke();
  }

  ctx.restore();
}

function drawTicksAndLabels(ctx, map, y_min, y_max, title, xVar) {
  ctx.save();
  ctx.font = `${fontPx}px Times New Roman`;
  ctx.fillStyle = "black";
  ctx.strokeStyle = "black";

  ctx.fillText(title, map.plotLeft + 6, map.plotTop + fontPx);

  const yAxis = (y_min <= 0 && 0 <= y_max) ?
    map.dataToPixel(0, 0)[1] : map.plotBottom;

  for (let t = -3; t <= 3; t++) {
    const [px] = map.dataToPixel(t, 0);
    ctx.beginPath();
    ctx.moveTo(px, yAxis);
    ctx.lineTo(px, yAxis + tickLenPx);
    ctx.stroke();

    const tw = ctx.measureText(t.toString()).width;
    ctx.fillText(t.toString(), px - tw / 2, yAxis + tickLenPx + 14);
  }

  const [xr] = map.dataToPixel(x_max, 0);
  ctx.fillText(xVar, xr + 8, yAxis);

  ctx.restore();
}

function drawCurve(ctx, map, x, y) {
  ctx.save();
  ctx.strokeStyle = "black";
  ctx.lineWidth = 2;

  ctx.beginPath();
  let [px, py] = map.dataToPixel(x[0], y[0]);
  ctx.moveTo(px, py);

  for (let i = 1; i < x.length; i++) {
    [px, py] = map.dataToPixel(x[i], y[i]);
    ctx.lineTo(px, py);
  }

  ctx.stroke();
  ctx.restore();
}

function redraw() {
  const canvas = document.getElementById("cv");
  const ctx = canvas.getContext("2d");

  const { dpr, cssW, cssH } = fitCanvas(canvas);

  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.setTransform(dpr,0,0,dpr,0,0);

  const signals = [
    { y: x_tau, title: convMode ? "x(τ)" : "x(t)", var: convMode ? "τ" : "t", ymin:-1, ymax:1 },
    { y: h_tau, title: convMode ? `h(${tNow}-τ)` : "h(t)", var: convMode ? "τ" : "t", ymin:0, ymax:1 },
    { y: xh_tau, title: convMode ? `x(τ)h(${tNow}-τ)` : " ", var:"τ", ymin:-1, ymax:1 },
    { y: y_out, title:"y(t)=x(t)*h(t)", var:"t", ymin:-1, ymax:1 }
  ];

  for (let p = 0; p < PANELS; p++) {
    const rect = makePanelRect(cssH, p);

//    ctx.save();
 //   ctx.fillStyle = "yellow";
 //   ctx.fillRect(0, rect.top, cssW, rect.bottom - rect.top);
 //   ctx.restore();

    if (!convMode && p > 1) continue;

    const map = makeMapping(cssW, rect, signals[p].ymin, signals[p].ymax);
    drawAxes(ctx, map, signals[p].ymin, signals[p].ymax);
    drawTicksAndLabels(ctx, map, signals[p].ymin, signals[p].ymax,
                       signals[p].title, signals[p].var);

    drawCurve(ctx, map, tau, signals[p].y);
  }
}

// ================================
// Controls
// ================================
function startPressed() {
  convMode = true;
  n = 0;
  tNow = 0;

  buildHShifted(tNow);
  elemMult();
  y_out[offset] = integrate();

  redraw();
}

function nextPressed() {
  if (!convMode) return;
  if (n + offset >= N-1) return;

  n++;
  tNow = round2(n * delta_t);

  buildHShifted(tNow);
  elemMult();
  y_out[n + offset] = integrate();

  redraw();
}

function resetPressed() {
  convMode = false;
  n = 0;
  tNow = 0;
  y_out.fill(0);
  buildH();
  redraw();
}

// ================================
// Main
// ================================
function init() {
  initTime();
  buildX();
  buildH();

  document.getElementById("startBtn").addEventListener("click", startPressed);
  document.getElementById("nextBtn").addEventListener("click", nextPressed);
  document.getElementById("resetBtn").addEventListener("click", resetPressed);

  window.addEventListener("resize", redraw);
  redraw();
}

init();
