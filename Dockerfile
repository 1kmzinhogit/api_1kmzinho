FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

# Gerar Prisma Client dentro do container
RUN npx prisma generate

RUN npm run build

# Porta padrão 3000
EXPOSE 3000

CMD ["npm", "start"]