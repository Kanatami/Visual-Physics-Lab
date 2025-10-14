// functions/index.js  (Firebase Functions v2 版)
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

// Admin SDK (v11+)
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

// Functions v2
const { onRequest } = require("firebase-functions/v2/https");
const swaggerUi = require("swagger-ui-express");

initializeApp();
const db = getFirestore();

const app = express();
// CORS は v2 の onRequest でも有効化できるが、Express 側でも許可しておく
app.use(cors({ origin: true }));
app.use(express.json());

// ---- Auth Guard ----
async function authGuard(req, res, next) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer (.+)$/);
  if (!m) return res.status(401).json({ error: "Missing token" });
  try {
    req.user = await getAuth().verifyIdToken(m[1]);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ---- Router (ベース /api) ----
const router = express.Router();

router.get("/runs", authGuard, async (req, res) => {
  const uid = req.user.uid;
  const snap = await db
    .collection("runs")
    .where("userId", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  const items = snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      createdAt: data.createdAt && data.createdAt.toDate
        ? data.createdAt.toDate().toISOString()
        : null
    };
  });
  res.json(items);
});

router.post("/runs", authGuard, async (req, res) => {
  const { v0, theta, h0, g, flightTime, range, hMax } = req.body || {};
  for (const k of ["v0", "theta", "h0", "g", "flightTime", "range", "hMax"]) {
    if (typeof req.body[k] !== "number") {
      return res.status(400).json({ error: `Invalid field: ${k}` });
    }
  }
  const docRef = await db.collection("runs").add({
    userId: req.user.uid,
    v0, theta, h0, g, flightTime, range, hMax,
    createdAt: FieldValue.serverTimestamp()
  });
  const snap = await docRef.get();
  const data = snap.data();
  res.status(201).json({
    id: snap.id,
    ...data,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || null
  });
});

router.get("/runs/:id", authGuard, async (req, res) => {
  const snap = await db.collection("runs").doc(req.params.id).get();
  if (!snap.exists) return res.status(404).json({ error: "Not Found" });
  const data = snap.data();
  if (data.userId !== req.user.uid) return res.status(403).json({ error: "Forbidden" });
  res.json({
    id: snap.id,
    ...data,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || null
  });
});

router.post("/quiz-results", authGuard, async (req, res) => {
  const { score, total } = req.body || {};
  if (!Number.isInteger(score) || !Number.isInteger(total)) {
    return res.status(400).json({ error: "score/total must be integers" });
  }
  const docRef = await db.collection("quizResults").add({
    userId: req.user.uid,
    score,
    total,
    createdAt: FieldValue.serverTimestamp()
  });
  const snap = await docRef.get();
  const data = snap.data();
  res.status(201).json({
    id: snap.id,
    ...data,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || null
  });
});

// OpenAPI (/api/docs)
const spec = YAML.parse(fs.readFileSync(path.join(__dirname, "openapi.yaml"), "utf8"));
router.use("/docs", swaggerUi.serve, swaggerUi.setup(spec));

// /api にマウント
app.use("/api", router);

// v2 では onRequest を使う（地域は emulator のデフォルトに合わせて us-central1 推奨）
exports.api = onRequest(
  { region: "us-central1", cors: true },  // ← まずはエミュと揃える。後で asia-southeast2 に変更可
  app
);
