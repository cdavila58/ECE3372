"use strict";
/*
Copyright (c) 2026 Carlos E. Davila

This software was developed for educational demonstrations
in ECE 3372: Introduction to Signal Processing at SMU.

All rights reserved. No permission is granted to copy,
modify, redistribute, or use this code without explicit
written permission from the author.

 * Conv Animate — JS port (faithful to your 2003 Swing applet logic)
 *
 * Key behaviors preserved:
 *  - Initial: Start enabled; others disabled. Signals selectable via dropdowns.
 *  - Start: switches to τ view, flips h buffer, sets t=0, shows panels 3&4.
 *  - Play: timer auto-increments t (via shifting h_buff).
 *  - Pause: stops timer.
 *  - Reset: returns to setup mode, restores default rect signals.
 */

// ================================
// Constants (match Java)
// ================================
const length_dat  = 512;
const length_buff = Math.floor(length_dat * 1.5); // 768
const t_points = [-3, -2, -1, 0, 1, 2, 3];
const delta_t = 6 / length_dat; // Java uses 6/length_dat
const delayMs = 100;

// Plot layout (like your earlier JS port)
const PANELS = 4;
const panelGap = 8;
const bottomPad = 6;

let x_space = 60;          // give room for y tick labels (you bumped this already)
let y_space = 14;
let tickLenPx = 6;
let fontPx = 18;

// Base (design) canvas size; scales to browser while preserving aspect ratio
const BASE_W = 280;
const BASE_H = 440;

// ================================
// Signal type menus (match Java strings)
// ================================
const x_signal_types = [
  "x(t) = u(t)",
  "x(t) = rect(t-0.5,1)",
  "x(t) = exp(-t)u(t)",
  "x(t) = sin(8t)u(t)"
];

const h_signal_types = [
  "h(t) = u(t)",
  "h(t) = rect(t-0.5,1)",
  "h(t) = exp(-t)u(t)",
  "h(t) = sin(8t)u(t)"
];

// ================================
// State (match Java semantics)
// ================================
let start_state = true;  // true means "setup mode"
let n = 0;
let tNow = 0;
let offset = 0;

let timerId = null;

// Data arrays
const t_dat  = new Float64Array(length_dat);
const x_dat  = new Float64Array(length_dat);
const h_dat  = new Float64Array(length_dat);
const xh_dat = new Float64Array(length_dat);
const y_dat  = new Float64Array(length_dat);

const h_buff = new Float64Array(length_buff);

// Panel metadata (like DrawPanel_old fields)
const panels = [
  { dat_on: true,  time_var: "t", signal_name: "x(t)", plot_dat: x_dat,  y_min: -1, y_max:  1 },
  { dat_on: true,  time_var: "t", signal_name: "h(t)", plot_dat: h_dat,  y_min:  0, y_max:  1 },
  { dat_on: false, time_var: " ", signal_name: " ",   plot_dat: xh_dat, y_min: -1, y_max:  1 },
  { dat_on: false, time_var: " ", signal_name: " ",   plot_dat: y_dat,  y_min: -1, y_max:  1 }
];

// ================================
// Init time axis + offset (like get_t_dat())
// ================================
function get_t_dat() {
  offset = 0;
  for (let i = 0; i < length_dat; i++) {
    t_dat[i] = t_points[0] + i * delta_t; // -3 + i*Δt
    y_dat[i] = 0;
  }
  // Java used (t_dat[n] == 0) which is risky; do "nearest to 0"
  let best = Infinity;
  for (let i = 0; i < length_dat; i++) {
    const a = Math.abs(t_dat[i]);
    if (a < best) { best = a; offset = i; }
  }
}

// ================================
// Signal generators (match Java behavior)
// ================================
function get_x_step() {
  for (let i = 0; i < length_dat; i++) x_dat[i] = (t_dat[i] >= 0) ? 1 : 0;
}

function get_x_pulse() {
  for (let i = 0; i < length_dat; i++) x_dat[i] = (t_dat[i] <= 1 && t_dat[i] >= 0) ? 1 : 0;
}

function get_x_exp() {
  for (let i = 0; i < length_dat; i++) x_dat[i] = (t_dat[i] < 0) ? 0 : Math.exp(-t_dat[i]);
}

function get_x_sin() {
  for (let i = 0; i < length_dat; i++) x_dat[i] = (t_dat[i] < 0) ? 0 : Math.sin(8 * t_dat[i]);
}

function fill_h_buff_step() {
  for (let i = 0; i < length_buff; i++) {
    const time = t_points[0] + i * delta_t; // -3 + i*Δt
    h_buff[i] = (time >= 0) ? 1 : 0;
  }
}

function fill_h_buff_pulse() {
  for (let i = 0; i < length_buff; i++) {
    const time = t_points[0] + i * delta_t;
    h_buff[i] = (time <= 1 && time >= 0) ? 1 : 0;
  }
}

function fill_h_buff_exp() {
  for (let i = 0; i < length_buff; i++) {
    const time = t_points[0] + i * delta_t;
    h_buff[i] = (time < 0) ? 0 : Math.exp(-time);
  }
}

function fill_h_buff_sin() {
  for (let i = 0; i < length_buff; i++) {
    const time = t_points[0] + i * delta_t;
    h_buff[i] = (time < 0) ? 0 : Math.sin(8 * time);
  }
}

// Java: System.arraycopy(h_buff, 0, h_dat, 0, length_dat)
function copy_h_buff_to_h_dat_left() {
  for (let i = 0; i < length_dat; i++) h_dat[i] = h_buff[i];
}

// Java: System.arraycopy(h_buff, length_dat/2, h_dat, 0, length_dat)
function copy_h_buff_window_centered() {
  const start = Math.floor(length_dat / 2); // 256
  for (let i = 0; i < length_dat; i++) h_dat[i] = h_buff[start + i];
}

// ================================
// Convolution helpers (match Java)
// ================================
function elem_mult() {
  for (let i = 0; i < length_dat; i++) xh_dat[i] = x_dat[i] * h_dat[i];
}

function sum_xh() {
  let s = 0;
  for (let i = 0; i < length_dat; i++) s += xh_dat[i];
  return s;
}

function flip_in_place(arr) {
  let i = 0, j = arr.length - 1;
  while (i < j) {
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
    i++; j--;
  }
}

// Java shift(): shift right by 1, insert 0 at [0]
function shift_right_one(arr) {
  for (let k = arr.length - 1; k >= 1; k--) arr[k] = arr[k - 1];
  arr[0] = 0;
}

function round2(x) {
  return Math.round(x * 100) / 100;
}

function formatNumber(v) {
  if (Math.abs(v) < 1e-12) v = 0;
  return v.toFixed(2).replace(/\.?0+$/, "");
}

// ================================
// UI wiring
// ================================
const el = {
  canvas: document.getElementById("cv"),
  xSelect: document.getElementById("xSelect"),
  hSelect: document.getElementById("hSelect"),
  startBtn: document.getElementById("startBtn"),
  playBtn: document.getElementById("playBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  resetBtn: document.getElementById("resetBtn"),
  tLabel: document.getElementById("tLabel")
};

function setButtons({ start, play, pause, reset }) {
  el.startBtn.disabled = !start;
  el.playBtn.disabled  = !play;
  el.pauseBtn.disabled = !pause;
  el.resetBtn.disabled = !reset;
}

function setTLabel(text) {
  el.tLabel.textContent = text || "\u00A0";
}

// ================================
// Canvas sizing (aspect ratio preserved)
// ================================
function fitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const availW = window.innerWidth;
  const availH = Math.floor(window.innerHeight * 0.90);

  const s = Math.min(availW / BASE_W, availH / BASE_H);

  const cssW = Math.floor(BASE_W * s);
  const cssH = Math.floor(BASE_H * s);

  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;

  canvas.width  = Math.max(1, Math.floor(cssW * dpr));
  canvas.height = Math.max(1, Math.floor(cssH * dpr));

  return { dpr, cssW, cssH, w: canvas.width, h: canvas.height };
}

function makePanelRect(cssH, panelIndex) {
  const totalGap = panelGap * (PANELS - 1);
  const panelH = (cssH - totalGap - bottomPad) / PANELS;
  const top = panelIndex * (panelH + panelGap);
  const bottom = top + panelH;
  return { top, bottom };
}

function getMinMax(arr) {
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  if (mn === mx) {
    if (mn === 0) { mn = -1; mx = 1; }
    else { mn -= 0.5 * Math.abs(mn); mx += 0.5 * Math.abs(mx); }
  }
  return { mn, mx };
}

function makeMapping(cssW, panelRect, y_min, y_max) {
  const plotLeft = x_space;
  const plotRight = cssW - x_space;
  const plotTop = panelRect.top + y_space;
  const plotBottom = panelRect.bottom - y_space;

  const sx = (plotRight - plotLeft) / (t_points[t_points.length - 1] - t_points[0]); // 6
  const sy = (plotBottom - plotTop) / (y_max - y_min);

  function dataToPixel(x, y) {
    const px = plotLeft + (x - t_points[0]) * sx;
    const py = plotBottom - (y - y_min) * sy;
    return [px, py];
  }

  return { plotLeft, plotRight, plotTop, plotBottom, dataToPixel };
}

function drawAxes(ctx, map, y_min, y_max) {
  ctx.save();
  ctx.strokeStyle = "blue";
  ctx.lineWidth = 1;

  // y-axis at x = -3
  {
    const [x0, y0] = map.dataToPixel(-3, y_min);
    const [x1, y1] = map.dataToPixel(-3, y_max);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  // x-axis at y=0 if in range
  if (y_min <= 0 && 0 <= y_max) {
    const [x0, y0] = map.dataToPixel(-3, 0);
    const [x1, y1] = map.dataToPixel( 3, 0);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  ctx.restore();
}

function drawTicksAndLabels(ctx, map, y_min, y_max, title, xVar) {
  ctx.save();
  ctx.font = `${fontPx}px Times New Roman`;
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1;

  // Title (signal name) near top-left
  ctx.fillText(title, map.plotLeft + 6, map.plotTop + fontPx);

  // x ticks: -3..3 integers
  const useXAxis = (y_min <= 0 && 0 <= y_max);
  const yTickBase = useXAxis ? map.dataToPixel(0, 0)[1] : map.plotBottom;

  for (let t = -3; t <= 3; t++) {
    const [px] = map.dataToPixel(t, 0);
    ctx.beginPath();
    ctx.moveTo(px, yTickBase);
    ctx.lineTo(px, yTickBase + tickLenPx);
    ctx.stroke();

    const s = `${t}`;
    const tw = ctx.measureText(s).width;
    ctx.fillText(s, px - tw / 2, yTickBase + tickLenPx + 14); // your “magic number”
  }

  // x-axis variable label on right end
  {
    const [xRight] = map.dataToPixel(3, 0);
    ctx.fillText(xVar, xRight + 8, yTickBase);
  }

  // y ticks at 0.5 spacing
  const step = 0.5;
  const start = Math.ceil(y_min / step) * step;
  for (let yv = start; yv <= y_max + 1e-12; yv += step) {
    const [xAxisPx, py] = map.dataToPixel(-3, yv);
    ctx.beginPath();
    ctx.moveTo(xAxisPx, py);
    ctx.lineTo(xAxisPx - tickLenPx, py);
    ctx.stroke();

    const lab = formatNumber(yv);
    const tw = ctx.measureText(lab).width;
    ctx.fillText(lab, xAxisPx - tickLenPx - 4 - tw, py + fontPx / 2 - 2);
  }

  ctx.restore();
}

function drawCurve(ctx, map, xArr, yArr, yMask /* optional */) {
  ctx.save();
  ctx.strokeStyle = "black";
  ctx.lineWidth = 2;

  // Find first valid point (if masking)
  let i0 = 0;
  if (yMask) {
    while (i0 < yArr.length && !yMask(i0)) i0++;
    if (i0 >= yArr.length) { ctx.restore(); return; }
  }

  ctx.beginPath();
  {
    const [px, py] = map.dataToPixel(xArr[i0], yArr[i0]);
    ctx.moveTo(px, py);
  }

  for (let i = i0 + 1; i < yArr.length; i++) {
    if (yMask && !yMask(i)) continue;
    const [px, py] = map.dataToPixel(xArr[i], yArr[i]);
    ctx.lineTo(px, py);
  }
  ctx.stroke();

  ctx.restore();
}

function redraw() {
  const { dpr, cssW, cssH, w, h } = fitCanvas(el.canvas);
  const ctx = el.canvas.getContext("2d");

  // Clear (physical pixels)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // Draw in CSS pixels
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Draw each panel
  for (let p = 0; p < PANELS; p++) {
    const rect = makePanelRect(cssH, p);

    // Panel background (yellow like your applet)
    //ctx.save();
    //ctx.fillStyle = "yellow";
    //ctx.fillRect(0, rect.top, cssW, rect.bottom - rect.top);
    //ctx.restore();

    const panel = panels[p];

    if (!panel.dat_on) continue;

    // Use min/max unless you want fixed ranges per panel
    const { mn, mx } = getMinMax(panel.plot_dat);
    const y_min = mn, y_max = mx;

    const map = makeMapping(cssW, rect, y_min, y_max);
    drawAxes(ctx, map, y_min, y_max);
    drawTicksAndLabels(ctx, map, y_min, y_max, panel.signal_name, panel.time_var);

    // For y(t), only show computed part (offset..offset+n)
    if (p === 3 && !start_state) {
      const mask = (i) => (i >= offset && i <= offset + n);
      drawCurve(ctx, map, t_dat, y_dat, mask);
    } else {
      drawCurve(ctx, map, t_dat, panel.plot_dat);
    }
  }
}

// ================================
// State transitions (buttons)
// ================================
function stopTimer() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

function applyDefaultSignals() {
  // Your Java fix: default to rect(t-0.5,1)
  el.xSelect.selectedIndex = 1;
  el.hSelect.selectedIndex = 1;
  get_x_pulse();
  fill_h_buff_pulse();
  copy_h_buff_to_h_dat_left();
}

function onStart() {
  // Start: switch to τ view and prepare convolution at t=0 (no auto increment yet)
  start_state = false;
  stopTimer();

  setButtons({ start: false, play: true, pause: false, reset: true });

  n = 0;
  tNow = 0;
  setTLabel("t = 0");

  // flip(h_buff), then copy centered window to h_dat
  flip_in_place(h_buff);
  copy_h_buff_window_centered();

  // product
  elem_mult();

  // show panels 3&4
  panels[2].dat_on = true;
  panels[3].dat_on = true;

  // relabel axes (τ for panels 1-3, t for panel 4)
  panels[0].time_var = "τ";
  panels[1].time_var = "τ";
  panels[2].time_var = "τ";
  panels[3].time_var = "t";

  // relabel signal names (numeric t substituted)
  panels[0].signal_name = "x(τ)";
  panels[1].signal_name = `h(${formatNumber(tNow)}-τ)`;
  panels[2].signal_name = `x(τ)h(${formatNumber(tNow)}-τ)`;
  panels[3].signal_name = "y(t) = x(t)*h(t)";

  redraw();
}

function stepOnce() {
  // Equivalent to Java timer tick "else if (n+offset < length_dat-1)"
  if (n + offset >= length_dat - 1) {
    stopTimer();
    setButtons({ start: false, play: false, pause: false, reset: true });
    return;
  }

  n++;
  tNow = round2(n * delta_t);
  setTLabel(`t = ${formatNumber(tNow)}`);

  // shift h_buff, copy centered window, multiply, integrate into y_dat
  shift_right_one(h_buff);
  copy_h_buff_window_centered();
  elem_mult();

  y_dat[n + offset] = sum_xh() * delta_t;

  // update labels with numeric t
  panels[1].signal_name = `h(${formatNumber(tNow)}-τ)`;
  panels[2].signal_name = `x(τ)h(${formatNumber(tNow)}-τ)`;

  redraw();
}

function onPlay() {
  if (start_state) return; // must press Start first
  stopTimer();
  setButtons({ start: false, play: false, pause: true, reset: true });

  timerId = setInterval(stepOnce, delayMs);
}

function onPause() {
  stopTimer();
  setButtons({ start: false, play: true, pause: false, reset: true });
}

function onReset() {
  stopTimer();

  start_state = true;
  n = 0;
  tNow = 0;

  setTLabel(" ");

  setButtons({ start: true, play: false, pause: false, reset: false });

  // restore labels + hide panels 3&4
  panels[0].time_var = "t";
  panels[1].time_var = "t";
  panels[2].time_var = " ";
  panels[3].time_var = " ";

  panels[0].signal_name = "x(t)";
  panels[1].signal_name = "h(t)";
  panels[2].signal_name = " ";
  panels[3].signal_name = " ";

  panels[2].dat_on = false;
  panels[3].dat_on = false;

  // restore default signals + time axis
  get_t_dat();
  applyDefaultSignals();

  redraw();
}

// ================================
// Dropdown handlers (only active in setup mode)
// ================================
function onXSelectChange() {
  if (!start_state) return;
  const sig = el.xSelect.value;

  if (sig === "x(t) = rect(t-0.5,1)") get_x_pulse();
  else if (sig === "x(t) = exp(-t)u(t)") get_x_exp();
  else if (sig === "x(t) = sin(8t)u(t)") get_x_sin();
  else if (sig === "x(t) = u(t)") get_x_step();

  redraw();
}

function onHSelectChange() {
  if (!start_state) return;
  const sig = el.hSelect.value;

  if (sig === "h(t) = rect(t-0.5,1)") fill_h_buff_pulse();
  else if (sig === "h(t) = exp(-t)u(t)") fill_h_buff_exp();
  else if (sig === "h(t) = sin(8t)u(t)") fill_h_buff_sin();
  else if (sig === "h(t) = u(t)") fill_h_buff_step();

  copy_h_buff_to_h_dat_left();
  redraw();
}

// ================================
// Main
// ================================
function init() {
  // Fill menus
  el.xSelect.innerHTML = x_signal_types.map(s => `<option>${s}</option>`).join("");
  el.hSelect.innerHTML = h_signal_types.map(s => `<option>${s}</option>`).join("");

  el.xSelect.addEventListener("change", onXSelectChange);
  el.hSelect.addEventListener("change", onHSelectChange);

  el.startBtn.addEventListener("click", onStart);
  el.playBtn.addEventListener("click", onPlay);
  el.pauseBtn.addEventListener("click", onPause);
  el.resetBtn.addEventListener("click", onReset);

  window.addEventListener("resize", redraw);

  // Initial app state: Start enabled, others disabled
  setButtons({ start: true, play: false, pause: false, reset: false });
  setTLabel(" ");

  // Initialize time axis + default rect signals (your Java fix)
  get_t_dat();
  applyDefaultSignals();

  redraw();
}


init();






