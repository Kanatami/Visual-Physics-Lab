(() => {
  // ------- DOM 取得 -------
  const $ = (id) => document.getElementById(id);
  const canvas = $("simCanvas");
  const ctx = canvas.getContext("2d");

  const v0El = $("v0");
  const angleEl = $("angle");
  const angleOut = $("angleOut");
  const h0El = $("h0");
  const gEl = $("g");
  const scaleEl = $("scale");
  const traceEl = $("trace");

  const tOut = $("tOut");
  const hOut = $("hOut");
  const rOut = $("rOut");
  const timeOut = $("timeOut");

  const startBtn = $("startBtn");
  const pauseBtn = $("pauseBtn");
  const resetBtn = $("resetBtn");
  const demoBtn  = $("demoBtn");

  // ------- 状態 -------
  let pxPerMeter = Number(scaleEl.value);
  let running = false;
  let t = 0;             // 経過時間
  let T = 0;             // 飛行時間
  let vx0 = 0, vy0 = 0;  // 初期速度の成分
  let hMax = 0, range = 0;
  let rafId = 0;
  let tracePts = [];     // 軌跡
  let worldWidthM = 0;   // ワールド幅[m]（キャンバスサイズから決定）
  let worldHeightM = 0;

  // ------- ユーティリティ -------
  const toRad = (deg) => (deg * Math.PI) / 180;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  // デバイスピクセル比に応じてキャンバスをスケーリング
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // CSSピクセル基準に戻す

    worldWidthM = Math.max(1, Math.floor(rect.width / pxPerMeter));
    worldHeightM = Math.max(1, Math.floor(rect.height / pxPerMeter));
    drawFrame(0, 0, 9.81, false); // 初期描画
  }

  // 物理量の再計算
  function recalc() {
    const v0 = Number(v0El.value);
    const th = toRad(Number(angleEl.value));
    const h0 = Number(h0El.value);
    const g  = Number(gEl.value);

    vx0 = v0 * Math.cos(th);
    vy0 = v0 * Math.sin(th);

    // 飛行時間（地面 y=0 に達する時刻の正の解）
    const disc = (vy0 ** 2) + 2 * g * h0;
    T = (vy0 + Math.sqrt(Math.max(0, disc))) / g;

    // 最高点
    hMax = h0 + (vy0 ** 2) / (2 * g);

    // 水平到達距離
    range = vx0 * T;

    // 出力
    tOut.textContent = `${T.toFixed(2)} s`;
    hOut.textContent = `${hMax.toFixed(2)} m`;
    rOut.textContent = `${range.toFixed(2)} m`;
  }

  // ワールド→キャンバス座標変換（原点は左下）
  function worldToCanvas(xm, ym) {
    const x = xm * pxPerMeter + 20; // 左へ余白
    const y = canvas.clientHeight - (ym * pxPerMeter + 20); // 下余白
    return [x, y];
  }

  // グリッドと地面の描画
  function drawGrid() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    ctx.clearRect(0, 0, w, h);

    // 背景（さりげないニューモーフィズム感）
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#f7f9fe");
    grad.addColorStop(1, "#e7ecf3");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 地面
    ctx.strokeStyle = "#c6cdd9";
    ctx.lineWidth = 2;
    const [gx1, gy] = worldToCanvas(0, 0);
    const [gx2] = worldToCanvas(worldWidthM, 0);
    ctx.beginPath();
    ctx.moveTo(gx1, gy);
    ctx.lineTo(gx2, gy);
    ctx.stroke();

    // 1m グリッド
    ctx.strokeStyle = "rgba(80,90,110,.25)";
    ctx.lineWidth = 1;
    for (let xm = 0; xm <= worldWidthM; xm += 1) {
      const [x] = worldToCanvas(xm, 0);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let ym = 0; ym <= worldHeightM; ym += 1) {
      const [, y] = worldToCanvas(0, ym);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  }

  // フレーム描画
  function drawFrame(xm, ym, g, drawTrace = true) {
    drawGrid();

    // 軌跡
    if (drawTrace && traceEl.checked && tracePts.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = "#4f7cff";
      ctx.lineWidth = 2;
      tracePts.forEach(([x, y], i) => {
        const [cx, cy] = worldToCanvas(x, y);
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      ctx.stroke();
    }

    // 弾
    const [cx, cy] = worldToCanvas(xm, ym);
    ctx.beginPath();
    ctx.fillStyle = "#2a2f3a";
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // シミュレーションの1ステップ
  function step(timestamp) {
    if (!running) return;

    const g = Number(gEl.value);
    // 60fps 相当
    const dt = 1 / 60;
    t += dt;

    const xm = vx0 * t;
    const ym = Number(h0El.value) + vy0 * t - 0.5 * g * t * t;

    // 画面外に出過ぎた場合は停止
    if (ym <= 0 || t >= T) {
      running = false;
      timeOut.textContent = `${T.toFixed(2)} s`;
      drawFrame(range, 0, g, true);
      return;
    }

    if (traceEl.checked) tracePts.push([xm, ym]);

    drawFrame(xm, ym, g, true);
    timeOut.textContent = `${t.toFixed(2)} s`;
    rafId = requestAnimationFrame(step);
  }

  // ------- イベント -------
  angleEl.addEventListener("input", () => {
    angleOut.textContent = `${angleEl.value}°`;
    recalc(); tracePts.length = 0; drawFrame(0, Number(h0El.value), Number(gEl.value), false);
  });
  [v0El, h0El, gEl, scaleEl].forEach(el => {
    el.addEventListener("input", () => {
      pxPerMeter = Number(scaleEl.value);
      recalc(); tracePts.length = 0; resizeCanvas();
    });
  });
  traceEl.addEventListener("change", () => { if (!running) drawFrame(0, Number(h0El.value), Number(gEl.value), true); });

  startBtn.addEventListener("click", () => {
    if (!running) {
      recalc();
      t = 0;
      tracePts.length = 0;
      running = true;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(step);
    }
  });

  pauseBtn.addEventListener("click", () => {
    running = !running;
    if (running) rafId = requestAnimationFrame(step);
  });

  resetBtn.addEventListener("click", () => {
    running = false;
    t = 0;
    timeOut.textContent = "0.00 s";
    tracePts.length = 0;
    drawFrame(0, Number(h0El.value), Number(gEl.value), false);
  });

  demoBtn.addEventListener("click", () => {
    v0El.value = 28; angleEl.value = 42; angleOut.textContent = "42°";
    h0El.value = 1.0; gEl.value = 9.81; scaleEl.value = 12;
    pxPerMeter = Number(scaleEl.value);
    recalc(); tracePts.length = 0; resizeCanvas();
  });

  // 初期化
  window.addEventListener("resize", resizeCanvas);
  recalc();
  resizeCanvas();
})();
