import "./config/env.js";

import { app } from "./app.js";
import { iniciarVerificadorRelatoriosDeLote } from "./services/loteNotificationScheduler.js";

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  iniciarVerificadorRelatoriosDeLote();
});
