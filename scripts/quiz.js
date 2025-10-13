(() => {
  const form = document.getElementById("quizForm");
  const submitBtn = document.getElementById("submitQuiz");
  const resetBtn = document.getElementById("resetQuiz");
  const result = document.getElementById("quizResult");

  // ここに問題を増やす（英語UI）
  const questions = [
    {
      id: "q1",
      text: "Which angle maximizes projectile range R? (no air resistance, h₀ = 0)",
      options: ["30°", "45°", "60°", "90°"],
      answer: 1
    },
    {
      id: "q2",
      text: "In y(t)=h₀+v₀sinθ·t−(1/2)g t² with upward positive, what is the sign of g?",
      options: ["Positive", "Negative", "Depends"],
      answer: 1
    }
  ];

  function render() {
    form.innerHTML = questions.map((q, idx) => {
      const opts = q.options.map((opt, i) => `
        <label class="option">
          <input type="radio" name="${q.id}" value="${i}"> ${opt}
        </label>
      `).join("");
      return `<div class="card" style="margin-bottom:12px">
        <h3>Q${idx+1}. ${q.text}</h3>
        <div class="options">${opts}</div>
      </div>`;
    }).join("");
  }

  function grade() {
    let correct = 0;
    questions.forEach(q => {
      const chosen = form.querySelector(`input[name="${q.id}"]:checked`);
      if (chosen && Number(chosen.value) === q.answer) correct++;
    });
    result.innerHTML = `<div class="card"><strong>${correct} / ${questions.length}</strong> correct</div>`;
  }

  function reset() {
    form.reset();
    result.innerHTML = "";
  }

  submitBtn.addEventListener("click", grade);
  resetBtn.addEventListener("click", reset);
  render();
})();
