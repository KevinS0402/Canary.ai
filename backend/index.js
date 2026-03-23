import cors from "cors";
import "dotenv/config";
import express from "express";
import sourceRoutes from "./lib/sourceRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3001);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/sources", sourceRoutes);

app.listen(PORT, () => {
  console.log(`Canary backend API listening on http://localhost:${PORT}`);
});
