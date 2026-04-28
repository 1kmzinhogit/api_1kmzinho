FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

# Gerar Prisma Client dentro do container
RUN npx prisma generate

RUN npm run build

# Copiar arquivo .env para produção
COPY .env .env

EXPOSE 3000

CMD ["npm", "start"]