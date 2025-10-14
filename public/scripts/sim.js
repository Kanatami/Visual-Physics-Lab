// 種類ごとの実装を動的 import（拡張前提の構造）
const simTypeEl  = document.getElementById("simType");
const startBtn   = document.getElementById("startBtn");
const pauseBtn   = document.getElementById("pauseBtn");
const resetBtn   = document.getElementById("resetBtn");
const m1Out      = document.getElementById("m1Out");
const m2Out      = document.getElementById("m2Out");
const m3Out      = document.getElementById("m3Out");
const timeOut    = document.getElementById("timeOut");
const controls   = document.getElementById("controls-slot");
const canvas     = document.getElementById("simCanvas");
const ctx        = canvas.getContext("2d");

// dpr対応キャンバス
function resizeCanvas(){
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

let sim = null;

async function loadSim(type){
  if (sim?.destroy) sim.destroy();
  controls.innerHTML = "";

  switch(type){
    case "parabolic":
    default: {
      const mod = await import("./sim/parabolic.js");
      sim = mod.createSimulation({
        canvas, ctx, controlsSlot: controls,
        outputs: { m1Out, m2Out, m3Out, timeOut }
      });
    }
  }
}

simTypeEl.addEventListener("change", e => loadSim(e.target.value));
startBtn.addEventListener("click", () => sim?.start?.());
pauseBtn.addEventListener("click", () => sim?.pause?.());
resetBtn.addEventListener("click", () => sim?.reset?.());
loadSim(simTypeEl.value);
