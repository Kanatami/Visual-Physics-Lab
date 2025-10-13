// 放物運動（UIは英語、必要箇所のみ日本語コメント）
export function createSimulation({ canvas, ctx, controlsSlot, outputs }) {
  // UI（最小）：各タイプはここで自分の入力UIを生成
  controlsSlot.innerHTML = `
    <div class="field">
      <label for="v0">Initial speed v₀ (m/s)</label>
      <input id="v0" type="number" min="1" step="1" value="25" />
    </div>
    <div class="field">
      <label for="angle">Launch angle θ (°)</label>
      <input id="angle" type="range" min="0" max="90" value="45" />
    </div>
    <div class="field">
      <label for="h0">Initial height h₀ (m)</label>
      <input id="h0" type="number" min="0" step="0.1" value="0" />
    </div>
    <div class="field">
      <label for="g">Gravity g (m/s²)</label>
      <input id="g" type="number" min="0.1" step="0.01" value="9.81" />
    </div>
    <div class="field">
      <label for="scale">Scale (px/m)</label>
      <input id="scale" type="number" min="5" step="1" value="10" />
    </div>
  `;

  const $ = (id) => controlsSlot.querySelector("#" + id);
  const v0El = $("v0"), angleEl = $("angle"), h0El = $("h0"), gEl = $("g"), scaleEl = $("scale");
  const { m1Out, m2Out, m3Out, timeOut } = outputs;

  // Readout labels（タイプごとに表示名を上書き）
  m1Out.previousElementSibling.textContent = "Current height y(t)";
  m2Out.previousElementSibling.textContent = "Current range x(t)";
  m3Out.previousElementSibling.textContent = "Flight time T (on impact)";

  // 状態
  let running = false, t = 0, T = 0, vx0 = 0, vy0 = 0, h0 = 0, g = 9.81, scale = 10, trace = [];
  const toRad = (d) => d * Math.PI / 180;

  function worldToCanvas(xm, ym) {
    const x = xm * scale + 20;
    const y = canvas.clientHeight - (ym * scale + 20);
    return [x, y];
  }

  function drawGrid() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0,0,w,h);
    grad.addColorStop(0, "#f7f9fe"); grad.addColorStop(1, "#e7ecf3");
    ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);
    // ground
    ctx.strokeStyle = "#c6cdd9"; ctx.lineWidth = 2;
    const [gx1, gy] = worldToCanvas(0, 0); const [gx2] = worldToCanvas(w/scale, 0);
    ctx.beginPath(); ctx.moveTo(gx1, gy); ctx.lineTo(gx2, gy); ctx.stroke();
  }

  function draw(xm, ym) {
    drawGrid();
    if (trace.length > 1) {
      ctx.beginPath(); ctx.strokeStyle = "#4f7cff"; ctx.lineWidth = 2;
      trace.forEach(([x,y], i) => {
        const [cx, cy] = worldToCanvas(x, y);
        if (i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
      });
      ctx.stroke();
    }
    const [cx, cy] = worldToCanvas(xm, ym);
    ctx.beginPath(); ctx.fillStyle = "#2a2f3a"; ctx.arc(cx, cy, 6, 0, Math.PI*2); ctx.fill();
  }

  function recalc() {
    const v0 = Number(v0El.value);
    const th = toRad(Number(angleEl.value));
    h0 = Number(h0El.value);
    g  = Number(gEl.value);
    scale = Number(scaleEl.value);
    vx0 = v0 * Math.cos(th);
    vy0 = v0 * Math.sin(th);
    const disc = (vy0 ** 2) + 2 * g * h0;
    T = (vy0 + Math.sqrt(Math.max(0, disc))) / g;
    // 表示は走行中に更新／停止時に確定
    m3Out.textContent = "—";
  }

  function step() {
    if (!running) return;
    const dt = 1/60;
    t += dt;
    const xm = vx0 * t;
    const ym = h0 + vy0 * t - 0.5 * g * t * t;

    if (ym <= 0 || t >= T) {
      running = false;
      timeOut.textContent = `${T.toFixed(2)} s`;
      m1Out.textContent = `0.00 m`;
      m2Out.textContent = `${(vx0*T).toFixed(2)} m`;
      m3Out.textContent = `${T.toFixed(2)} s`;
      draw(vx0*T, 0);
      return;
    }

    trace.push([xm, ym]); if (trace.length > 1000) trace.shift();
    draw(xm, ym);
    timeOut.textContent = `${t.toFixed(2)} s`;
    m1Out.textContent = `${Math.max(0, ym).toFixed(2)} m`;
    m2Out.textContent = `${Math.max(0, xm).toFixed(2)} m`;
    requestAnimationFrame(step);
  }

  function start() {
    if (running) return;
    recalc(); running = true; t = 0; trace = [];
    timeOut.textContent = "0.00 s"; m1Out.textContent = "0.00 m"; m2Out.textContent = "0.00 m";
    requestAnimationFrame(step);
  }
  function pause(){ running = !running; if (running) requestAnimationFrame(step); }
  function reset(){ running = false; t = 0; trace = []; timeOut.textContent = "0.00 s"; m1Out.textContent = "—"; m2Out.textContent = "—"; m3Out.textContent = "—"; draw(0, Number(h0El.value)); }

  // 初期描画＆入力が変わったら再描画（停止中のみ）
  recalc(); draw(0, Number(h0El.value));
  [v0El, angleEl, h0El, gEl, scaleEl].forEach(el => {
    el.addEventListener("input", () => { if (!running) { recalc(); draw(0, Number(h0El.value)); } });
  });

  return { start, pause, reset, destroy(){ /* 今は不要 */ } };
}
