/* API呼び出し（Functions の /api に保存） */
window.saveRunToCloud = async function ({ v0, theta, h0, g, T, R, hMax }) {
  const user = firebase.auth().currentUser;
  if (!user) throw new Error("Not authenticated");
  const idToken = await user.getIdToken();

  const res = await fetch("/api/runs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`
    },
    body: JSON.stringify({
      v0, theta, h0, g,
      flightTime: T,
      range: R,
      hMax
    })
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return await res.json();
};
