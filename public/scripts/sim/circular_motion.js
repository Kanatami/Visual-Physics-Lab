/* Uniform Circular Motion & Banked Curve
   - UI: English / コメント: 必要箇所のみ
   - DPR対応: fitCanvasToCSS() を追加してリサイズでも真円維持＆高精細
*/
(function () {
  const KEY = "circular_motion";
  const TITLE = "Uniform Circular Motion & Banked Curve";

  const deg2rad = d => (d * Math.PI) / 180;
  const rad2deg = r => (r * 180) / Math.PI;

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function sliderRow(id, label, unit, min, max, step, val) {
    const row = el("div", "row");
    const lab = el("label", "label");
    lab.htmlFor = id; lab.textContent = `${label} (${unit})`;
    const out = el("span", "value", String(val));
    const input = el("input");
    input.type = "range"; input.id = id; input.min = min; input.max = max; input.step = step; input.value = val;
    input.oninput = () => { out.textContent = input.value; };
    row.append(lab, input, out);
    return { row, input, out };
  }
  function register(def) {
    if (typeof window.registerSimulation === "function") window.registerSimulation(def);
    else { window.SimRegistry = window.SimRegistry || {}; window.SimRegistry[def.key] = def; }
  }

  // DPR対応
  function fitCanvasToCSS(canvas, ctx) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(300, Math.floor(rect.width));
    const cssH = Math.max(200, Math.floor(rect.height));
    const wantW = Math.round(cssW * dpr);
    const wantH = Math.round(cssH * dpr);
    if (canvas.width !== wantW || canvas.height !== wantH) {
      canvas.width = wantW;
      canvas.height = wantH;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function speedRange(thetaDeg, mu, r, g) {
    const th = deg2rad(thetaDeg);
    const s = Math.sin(th), c = Math.cos(th);
    const denomMax = (c - mu * s);
    const denomMin = (c + mu * s);
    let v2max = Infinity, v2min = 0;
    if (denomMax > 0) {
      const val = g * r * (s + mu * c) / denomMax;
      if (val > 0) v2max = val;
    }
    if (denomMin > 0) {
      const val = g * r * (s - mu * c) / denomMin;
      if (val > 0) v2min = val;
    }
    return { vMin: Math.sqrt(v2min), vMax: (v2max === Infinity ? Infinity : Math.sqrt(v2max)) };
  }
  const idealBankDeg = (v, r, g) => rad2deg(Math.atan((v * v) / (r * g)));

  register({
    key: KEY,
    title: TITLE,

    init(container) {
      // layout
      const wrap = el("div", "");
      wrap.style.display = "grid";
      wrap.style.gridTemplateColumns = "340px 1fr";
      wrap.style.gap = "24px";

      const panel = el("div", "card", ""); panel.style.padding = "16px";
      const vS = sliderRow("v0", "Speed v", "m/s", 2, 60, 0.5, 25);
      const rS = sliderRow("r", "Radius r", "m", 5, 80, 1, 25);
      const bS = sliderRow("bank", "Bank angle θ", "deg", 0, 45, 0.5, 15);
      const mS = sliderRow("mu", "Friction μ", "-", 0, 1.0, 0.01, 0.30);
      const gS = sliderRow("g", "Gravity g", "m/s²", 1, 20, 0.01, 9.81);

      panel.append(el("h3", "", TITLE), vS.row, rS.row, bS.row, mS.row, gS.row);

      const btnRow = el("div", "row"); btnRow.style.gap = "12px";
      const startBtn = el("button", "btn primary", "Start");
      const resetBtn = el("button", "btn danger", "Reset");
      const saveBtn  = el("button", "btn", "Save Only");
      btnRow.append(startBtn, resetBtn, saveBtn);
      const status = el("div", "status"); status.style.marginTop = "12px";
      panel.append(btnRow, status);

      const view = el("div", "card", ""); view.style.position = "relative";
      const canvas = el("canvas"); canvas.style.width = "100%"; canvas.style.display = "block";
      const hud = el("div", "hud");
      Object.assign(hud.style, {
        position:"absolute", left:"16px", top:"16px", padding:"12px 14px",
        borderRadius:"12px", background:"#e0e5ecaa",
        boxShadow:"8px 8px 16px #b8bcc2, -8px -8px 16px #ffffff",
        fontFamily:"system-ui, ui-sans-serif, Segoe UI, Helvetica, Arial", fontSize:"14px"
      });
      view.append(canvas, hud);

      wrap.append(panel, view);
      container.innerHTML = "";
      container.appendChild(wrap);

      const ctx = canvas.getContext("2d");
      fitCanvasToCSS(canvas, ctx); // 初期フィット

      // state
      let running = false;
      let t = 0, theta = 0, rafId = 0;

      function params() {
        return {
          v: parseFloat(vS.input.value),
          r: parseFloat(rS.input.value),
          bankDeg: parseFloat(bS.input.value),
          mu: parseFloat(mS.input.value),
          g: parseFloat(gS.input.value)
        };
      }
      function derived(p) {
        const omega = p.v / p.r;
        const ac = (p.v * p.v) / p.r;
        const lapTime = (2 * Math.PI * p.r) / p.v;
        const thetaIdeal = idealBankDeg(p.v, p.r, p.g);
        const range = speedRange(p.bankDeg, p.mu, p.r, p.g);
        return { omega, ac, lapTime, thetaIdeal, range };
      }
      function slipStatus(p, d) {
        const { vMin, vMax } = d.range;
        if (vMax !== Infinity && p.v > vMax + 1e-9) return "Outward slip risk";
        if (p.v < vMin - 1e-9) return "Inward slip risk";
        return "No slip";
      }

      function draw(p, d) {
        const W = canvas.clientWidth, H = canvas.clientHeight;
        ctx.clearRect(0, 0, W, H);

        // 背景グリッド
        ctx.save();
        ctx.strokeStyle = "#d4dae2";
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        ctx.restore();

        // 円路（真円維持）
        const cx = W * 0.5, cy = H * 0.55;
        const pxPerM = Math.min((W * 0.35) / p.r, (H * 0.45) / p.r);
        const Rpx = Math.max(20, p.r * pxPerM);

        ctx.beginPath();
        ctx.arc(cx, cy, Rpx, 0, Math.PI * 2);
        ctx.strokeStyle = "#5e6774";
        ctx.lineWidth = 3;
        ctx.stroke();

        // 車両
        const x = cx + Rpx * Math.cos(theta);
        const y = cy + Rpx * Math.sin(theta);
        ctx.beginPath(); ctx.fillStyle = "#1f2937"; ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();

        // 速度ベクトル
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.lineTo(x + 30 * (-Math.sin(theta)), y + 30 * (Math.cos(theta)));
        ctx.strokeStyle = "#111827"; ctx.lineWidth = 2; ctx.stroke();

        // 向心加速度ベクトル
        const ux = (cx - x), uy = (cy - y);
        const ulen = Math.hypot(ux, uy) || 1;
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.lineTo(x + 40 * (ux / ulen), y + 40 * (uy / ulen));
        ctx.strokeStyle = "#2563eb"; ctx.lineWidth = 2; ctx.stroke();

        // バンク角ゲージ
        ctx.save();
        const gx = W - 120, gy = 100;
        ctx.translate(gx, gy);
        ctx.beginPath(); ctx.arc(0, 0, 48, 0, Math.PI * 2); ctx.strokeStyle = "#5e6774"; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,0);
        ctx.arc(0,0,48, -Math.PI/2, -Math.PI/2 + deg2rad(p.bankDeg), false);
        ctx.closePath(); ctx.fillStyle = "#93c5fd"; ctx.fill();
        ctx.fillStyle = "#111827"; ctx.font = "12px system-ui, -apple-system, Segoe UI"; ctx.textAlign = "center";
        ctx.fillText(`bank ${p.bankDeg.toFixed(1)}°`, 0, 64);
        ctx.restore();

        // HUD
        hud.innerHTML =
          `ω = ${(d.omega).toFixed(3)} rad/s<br>` +
          `a<sub>c</sub> = ${(d.ac).toFixed(2)} m/s²<br>` +
          `Lap time T = ${(d.lapTime).toFixed(2)} s<br>` +
          `θ* (ideal) ≈ ${d.thetaIdeal.toFixed(1)}°<br>` +
          `Safe v: ${d.range.vMin.toFixed(2)} – ${d.range.vMax === Infinity ? "∞" : d.range.vMax.toFixed(2)} m/s<br>` +
          `<b>Status: ${slipStatus(p, d)}</b>`;
      }

      function setStatus(text) { status.textContent = text; }

      function reset() {
        running = false; cancelAnimationFrame(rafId);
        theta = 0; t = 0;
        const p = params(); const d = derived(p);
        draw(p, d); setStatus("Ready.");
      }

      async function saveResult(p, d) {
        const payload = {
          v0: p.v, theta: p.bankDeg, h0: 0, g: p.g,
          flightTime: d.lapTime,            // 1周時間
          range: 2 * Math.PI * p.r,         // 周長
          hMax: d.ac                        // 向心加速度
        };
        if (window.saveRunToCloud) {
          try { await window.saveRunToCloud(payload); setStatus("Saved to cloud."); }
          catch { setStatus("Saved locally (cloud failed)."); }
        }
      }

      function run() {
        if (running) return;
        running = true;
        const p = params(); const d = derived(p);
        setStatus("Running…");
        const step = () => {
          if (!running) return;
          const p2 = params(); const d2 = derived(p2);
          const dt = 1/60; t += dt; theta = (theta + d2.omega * dt) % (Math.PI * 2);
          draw(p2, d2);
          if (t >= d2.lapTime) {
            running = false; setStatus("Completed 1 lap."); saveResult(p2, d2); return;
          }
          rafId = requestAnimationFrame(step);
        };
        rafId = requestAnimationFrame(step);
      }

      // イベント
      startBtn.onclick = run;
      resetBtn.onclick = reset;
      saveBtn.onclick  = () => { const p=params(), d=derived(p); saveResult(p,d); };
      [vS.input, rS.input, bS.input, mS.input, gS.input].forEach(inp => {
        inp.addEventListener("input", () => { if (!running) { const p=params(), d=derived(p); draw(p,d); setStatus("Ready."); } });
      });

      // リサイズ対応：フィットして再描画（真円維持）
      window.addEventListener('resize', () => {
        fitCanvasToCSS(canvas, ctx);
        const p = params(); const d = derived(p);
        draw(p, d);
      });

      // 初期描画
      reset();

      return { start: run, pause(){ running = !running; if (running) run(); }, reset };
    }
  });
})();