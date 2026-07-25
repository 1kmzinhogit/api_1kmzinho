import cors from "cors";
import express from "express";
import routes from "./routes/index.js";

const app = express();

// Cada variável pode receber uma ou mais URLs separadas por vírgula. Isso permite
// manter, por exemplo, o site principal e mais de um domínio do painel publicados.
const origensPermitidas = [process.env.FRONTEND_URL, process.env.ADMIN_FRONTEND_URL]
  .flatMap((origens) => origens?.split(",") ?? [])
  .map((origem) => origem.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(cors({
  origin: (origem, callback) => {
    const origemNormalizada = origem?.replace(/\/$/, "");
    if (!origemNormalizada || origensPermitidas.includes(origemNormalizada)) return callback(null, true);
    return callback(new Error("Origem não permitida pelo CORS."));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "x-admin-token", "X-Admin-Client"]
}));

app.use(express.json());
app.use(routes);

export { app };
