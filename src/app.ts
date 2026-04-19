import express from "express";
import dotenv from "dotenv";
import routes from "./routes/index.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(routes);

app.listen(3000, () => console.log("Servidor rodando na porta 3000"));

// Ponto de entrada da aplicação.
// Configura o Express, carrega variáveis de ambiente e sobe o servidor.