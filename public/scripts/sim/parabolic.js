/* Projectile (Parabolic) Motion
   - UI: English / コメント: 必要箇所のみ日本語
   - DPR対応: fitCanvasToCSS() を追加してリサイズでも比率崩れなし
*/
(function () {
  const KEY = "projectile";
  const TITLE = "Projectile (Parabolic) Motion";

  const deg2rad = d => (d * Math.PI) / 180;

  // DOM util
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function sliderRow(id, label, unit, min, max, step, val) {
    const row = el("div", "row");
    const lab = el("label", "label"); lab.htmlFor = id; lab.textContent = `${label} (${unit})`;
    const out = el("span", "value", String(val));
    const input = el("input"); input.type = "range"; input.id = id; input.min = min; input.max = max; input.step = step; input.value = val;
    input.oninput = () => { out.textContent = input.value; };
    row.append(lab, input, out);
    return { row, input, out };
  }
  function numberRow(id, label, unit, min, step, val) {
    const row = el("div", "row");
    const lab = el("label", "label"); lab.htmlFor = id; lab.textContent = `${label} (${unit})`;
    const input = el("input"); input.type = "number"; input.id = id; input.min = String(min); input.step = String(step); input.value = String(val);
    row.append(lab, input);
    return { row, input };
  }
  function register(def) {
    if (typeof window.registerSimulation === "function") window.registerSimulation(def);
    else { window.SimRegistry = window.SimRegistry || {}; window.SimRegistry[def.key] = def; }
  }

  // CSSサイズに内部バッファをフィット（DPR対応）
  function fitCanvasToCSS(canvas, ctx) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect(); // CSSサイズ
    const cssW = Math.max(300, Math.floor(rect.width));
    const cssH = Math.max(200, Math.floor(rect.height));
    const wantW = Math.round(cssW * dpr);
    const wantH = Math.round(cssH * dpr);
    if (canvas.width !== wantW || canvas.height !== wantH) {
      canvas.width = wantW;
      canvas.height = wantH;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // 1単位=1CSSピクセルに
    }
  }

  register({
    key: KEY,
    title: TITLE,

    init(container) {
      // layout
      const wrap = el("div", "");
      wrap.style.display = "grid";
      wrap.style.gridTemplateColumns = "340px 1fr";
      wrap.style.gap = "24px";

      const panel = el("div", "card"); panel.style.padding = "16px";
      panel.append(el("h3", "", TITLE));

      const vS  = sliderRow("v0", "Initial speed v0", "m/s", 1, 80, 0.5, 25);
      const thS = sliderRow("theta", "Launch angle θ", "deg", 0, 85, 0.5, 45);
      const hS  = numberRow("h0", "Initial height h0", "m", 0, 0.1, 0);
      const gS  = numberRow("g", "Gravity g", "m/s²", 0.1, 0.01, 9.81);
      const scS = numberRow("scale", "Scale", "px/m", 5, 1, 10);
      panel.append(vS.row, thS.row, hS.row, gS.row, scS.row);

      const btnRow = el("div", "row"); btnRow.style.gap = "12px";
      const startBtn = el("button", "btn primary", "Start");
      const resetBtn = el("button", "btn danger",  "Reset");
      const saveBtn  = el("button", "btn",         "Save Only");
      btnRow.append(startBtn, resetBtn, saveBtn);
      panel.append(btnRow);

      const status = el("div", "status"); status.style.marginTop = "12px";
      panel.append(status);

      const view = el("div", "card"); view.style.position = "relative";
      const canvas = el("canvas"); canvas.style.width = "100%"; canvas.style.display = "block";
      const hud = el("div", "");
      Object.assign(hud.style, {
        position:"absolute", left:"16px", top:"16px", padding:"10px 12px",
        borderRadius:"12px", background:"#e0e5ecaa",
        boxShadow:"8px 8px 16px #b8bcc2, -8px -8px 16px #ffffff",
        fontFamily:"system-ui, -apple-system, Segoe UI, Helvetica, Arial", fontSize:"14px"
      });
      view.append(canvas, hud);
      wrap.append(panel, view);
      container.innerHTML = ""; container.appendChild(wrap);

      const ctx = canvas.getContext("2d");
      fitCanvasToCSS(canvas, ctx); // 初期フィット

      // state
      let running = false, t = 0, T = 0, vx0 = 0, vy0 = 0, h0 = 0, g = 9.81, scale = 10;
      let v0cur = 25, thetaDeg = 45, hMaxVal = 0;
      let trace = [];

      function worldToCanvas(xm, ym) {
        const x = xm * scale + 20;
        const y = canvas.clientHeight - (ym * scale + 20);
        return [x, y];
      }
      function drawGrid() {
        const W = canvas.clientWidth, H = canvas.clientHeight;
        ctx.clearRect(0,0,W,H);
        const grad = ctx.createLinearGradient(0,0,W,H);
        grad.addColorStop(0,"#f7f9fe"); grad.addColorStop(1,"#e7ecf3");
        ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);
        ctx.strokeStyle = "#c6cdd9"; ctx.lineWidth = 2;
        const [gx1, gy] = worldToCanvas(0,0); const [gx2] = worldToCanvas(W/scale,0);
        ctx.beginPath(); ctx.moveTo(gx1,gy); ctx.lineTo(gx2,gy); ctx.stroke();
      }
      function draw(xm, ym) {
        drawGrid();
        if (trace.length > 1) {
          ctx.beginPath(); ctx.strokeStyle = "#4f7cff"; ctx.lineWidth = 2;
          trace.forEach(([x,y],i)=>{ const [cx,cy]=worldToCanvas(x,y); if(i===0)ctx.moveTo(cx,cy); else ctx.lineTo(cx,cy); });
          ctx.stroke();
        }
        const [cx, cy] = worldToCanvas(xm, ym);
        ctx.beginPath(); ctx.fillStyle = "#2a2f3a"; ctx.arc(cx,cy,6,0,Math.PI*2); ctx.fill();
      }
      const setStatus = (s)=> status.textContent = s;

      function recalc() {
        const v0 = parseFloat(vS.input.value);
        const th = deg2rad(parseFloat(thS.input.value));
        v0cur = v0; thetaDeg = parseFloat(thS.input.value);
        h0 = parseFloat(hS.input.value);
        g  = parseFloat(gS.input.value);
        scale = parseFloat(scS.input.value);
        vx0 = v0 * Math.cos(th); vy0 = v0 * Math.sin(th);
        const disc = (vy0**2) + 2*g*h0;
        T = (vy0 + Math.sqrt(Math.max(0, disc))) / g;   // 着弾時刻
        hMaxVal = h0 + (vy0*vy0)/(2*g);                 // 最高到達点
        hud.innerHTML =
          `v0 = ${v0.toFixed(2)} m/s, θ = ${thetaDeg.toFixed(1)}°<br>`+
          `h0 = ${h0.toFixed(2)} m, g = ${g.toFixed(2)} m/s²<br>`+
          `T (impact) ≈ ${T.toFixed(2)} s, h<sub>max</sub> ≈ ${hMaxVal.toFixed(2)} m`;
      }

      function step() {
        if (!running) return;
        const dt = 1/60; t += dt;
        const xm = vx0 * t;
        const ym = h0 + vy0 * t - 0.5 * g * t * t;

        if (ym <= 0 || t >= T) {
          running = false;
          const R = vx0 * T;
          draw(R, 0);
          setStatus(`Completed. Range=${R.toFixed(2)} m, T=${T.toFixed(2)} s.`);
          if (window.saveRunToCloud) {
            window.saveRunToCloud({
              v0: v0cur, theta: thetaDeg, h0, g,
              flightTime: T, range: R, hMax: hMaxVal
            }).catch(()=>{});
          }
          return;
        }
        trace.push([xm, ym]); if (trace.length > 1000) trace.shift();
        draw(xm, ym);
        setStatus(`t=${t.toFixed(2)} s, x=${Math.max(0,xm).toFixed(2)} m, y=${Math.max(0,ym).toFixed(2)} m`);
        requestAnimationFrame(step);
      }

      function start(){ if (running) return; recalc(); running = true; t = 0; trace = []; setStatus("Running…"); requestAnimationFrame(step); }
      function reset(){ running = false; t = 0; trace = []; recalc(); draw(0, parseFloat(hS.input.value)); setStatus("Ready."); }
      async function saveOnly(){
        recalc();
        const R = (v0cur * Math.cos(deg2rad(thetaDeg))) * T;
        if (window.saveRunToCloud) {
          try {
            await window.saveRunToCloud({ v0: v0cur, theta: thetaDeg, h0, g, flightTime: T, range: R, hMax: hMaxVal });
            setStatus("Saved to cloud.");
          } catch { setStatus("Saved locally (cloud failed)."); }
        }
      }

      startBtn.onclick = start;
      resetBtn.onclick = reset;
      saveBtn.onclick  = saveOnly;
      [vS.input, thS.input, hS.input, gS.input, scS.input].forEach(inp=>{
        inp.addEventListener("input", ()=>{ if(!running){ recalc(); draw(0, parseFloat(hS.input.value)); setStatus("Ready."); } });
      });

      // リサイズ時もDPRに合わせて再フィット＆再描画
      window.addEventListener('resize', () => {
        fitCanvasToCSS(canvas, ctx);
        if (running) {
          // 現在時刻に基づき再描画（位置を再計算）
          const xm = vx0 * t;
          const ym = h0 + vy0 * t - 0.5 * g * t * t;
          draw(xm, Math.max(0, ym));
        } else {
          recalc(); draw(0, parseFloat(hS.input.value));
        }
      });

      recalc(); draw(0, parseFloat(hS.input.value)); setStatus("Ready.");
      return { start, pause(){ running = !running; if (running) requestAnimationFrame(step); }, reset };
    }
  });
})();