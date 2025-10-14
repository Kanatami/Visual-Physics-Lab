const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const YAML = require("yaml");
const swaggerUi = require("swagger-ui-express");

// Firebase Admin 初期化
admin.initializeApp();

const app = express();

// CORS（必要に応じて origin を絞る）
app.use(cors({ origin: true }));
app.use(express.json());

// ==== 認証ガード（Firebase ID トークンを検証） ====
async function authGuard(req, res, next) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer (.+)$/);
  if (!m) return res.status(401).json({ error: "Missing token" });
  try {
    req.user = await admin.auth().verifyIdToken(m[1]);
    return next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ==== Firestore 参照 ====
const db = admin.firestore();
const runsCol = () => db.collection("runs");
const quizCol = () => db.collection("quizResults");

// ==== /api/runs ====

// GET /runs: 自分の実行履歴（最新50件）
app.get("/runs", authGuard, async (req, res) => {
  const uid = req.user.uid;
  const snap = await runsCol()
    .where("userId", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  const items = snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate?.()?.toISOString() || null
  }));
  res.json(items);
});

// POST /runs: 実行結果を保存
app.post("/runs", authGuard, async (req, res) => {
  const uid = req.user.uid;
  const { v0, theta, h0, g, flightTime, range, hMax } = req.body || {};
  // 簡易バリデーション（※必要に応じて厳密化）
  for (const k of ["v0", "theta", "h0", "g", "flightTime", "range", "hMax"]) {
    if (typeof req.body[k] !== "number") {
      return res.status(400).json({ error: `Invalid field: ${k}` });
    }
  }
  const data = {
    userId: uid,
    v0, theta, h0, g, flightTime, range, hMax,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };
  const docRef = await runsCol().add(data);
  const doc = await docRef.get();
  const saved = { id: doc.id, ...doc.data() };
  saved.createdAt = saved.createdAt?.toDate?.()?.toISOString() || null;
  res.status(201).json(saved);
});

// GET /runs/:id: 単一取得（本人のみ）
app.get("/runs/:id", authGuard, async (req, res) => {
  const uid = req.user.uid;
  const doc = await runsCol().doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: "Not Found" });
  const data = doc.data();
  if (data.userId !== uid) return res.status(403).json({ error: "Forbidden" });
  data.createdAt = data.createdAt?.toDate?.()?.toISOString() || null;
  res.json({ id: doc.id, ...data });
});

// ==== /api/quiz-results ====

// POST /quiz-results: クイズ結果を保存
app.post("/quiz-results", authGuard, async (req, res) => {
  const uid = req.user.uid;
  const { score, total } = req.body || {};
  if (!Number.isInteger(score) || !Number.isInteger(total)) {
    return res.status(400).json({ error: "score/total must be integers" });
  }
  const data = {
    userId: uid,
    score, total,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };
  const docRef = await quizCol().add(data);
  const doc = await docRef.get();
  const saved = { id: doc.id, ...doc.data() };
  saved.createdAt = saved.createdAt?.toDate?.()?.toISOString() || null;
  res.status(201).json(saved);
});

// ==== OpenAPI ドキュメント（/api/docs） ====
// functions/openapi.yaml を読み込んで Swagger UI に渡す
const specPath = path.join(__dirname, "openapi.yaml");
const spec = YAML.parse(fs.readFileSync(specPath, "utf8"));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(spec));

// Cloud Functions として公開（リージョンは必要に応じて変更）
exports.api = functions.region("asia-southeast2").https.onRequest(app);
