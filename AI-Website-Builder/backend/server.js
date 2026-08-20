import express from "express";
import cors from "cors";
import "dotenv/config";
import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

import { connectDB } from "./config/db.js";

import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import communityRoutes from "./routes/community.js";
import paymentRoutes from "./routes/payments.js";

const PORT = 4000;

const app = express();

// CORS — allow the frontend (Vite dev server) to call this API.
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));

connectDB();

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/payments", paymentRoutes);

// Simple health-check route so you can confirm the API is up in the browser.
app.get("/", (req, res) => {
  res.send("API Working");
});

// Start listening for requests and log the URL once the server is ready.
const server = app.listen(PORT, () => {
  console.log(`Server Started on http://localhost:${PORT}`);
});
