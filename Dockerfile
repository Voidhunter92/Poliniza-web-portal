# Poliniza — sitio web + portal de clientes
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# Datos y archivos subidos: deben montarse como volumen persistente en Coolify
# (ver DEPLOY.md) para no perderse en cada redeploy.
RUN mkdir -p server/data server/uploads/reports

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server/app.js"]
