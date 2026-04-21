import dotenv from "dotenv";
dotenv.config(); // carrega o .env logo no início

import express from "express";
import { mp } from "./config/mercadoPago.js"; // só importa depois de carregar o .env

const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Servidor rodando com Mercado Pago configurado!");
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
