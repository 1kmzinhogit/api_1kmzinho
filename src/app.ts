import cors from "cors";
import express from "express";
import routes from "./routes/index.js";

const app = express();

const origensPermitidas = [process.env.FRONTEND_URL, process.env.ADMIN_FRONTEND_URL]
  .filter((origem): origem is string => Boolean(origem));

app.use(cors({
  origin: (origem, callback) => {
    if (!origem || origensPermitidas.includes(origem)) return callback(null, true);
    return callback(new Error("Origem não permitida pelo CORS."));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "x-admin-token"]
}));

app.use(express.json());
app.use(routes);

export { app };
