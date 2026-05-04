import dotenv from "dotenv";
dotenv.config();

// Variáveis obrigatórias
const requiredVars = [
  "DATABASE_URL",
  "DIRECT_URL", 
  "MP_ACCESS_TOKEN",
  "FRONTEND_URL",
  "PORT"
];

// Verificar variáveis obrigatórias em produção
if (process.env.NODE_ENV === "production") {
  const missing = requiredVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.warn(`⚠️ Variáveis de ambiente faltando: ${missing.join(", ")}`);
  }
}

export const config = {
  database: {
    url: process.env.DATABASE_URL!,
    directUrl: process.env.DIRECT_URL!,
  },
  mercadoPago: {
    accessToken: process.env.MP_ACCESS_TOKEN!,
  },
  app: {
    port: parseInt(process.env.PORT || "3000", 10),
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
    apiPublicUrl: process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`,
    env: process.env.NODE_ENV || "development",
  },
  email: {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || "587", 10),
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD ?? process.env.EMAIL_PASS,
  }
};
