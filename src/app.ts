import cors from "cors";
import express from "express";
import routes from "./routes/index.js";

const app = express();

// CORS configurado para aceitar apenas o frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(routes);

export { app };