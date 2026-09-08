# Backend del Sistema de Expediente Clinico y Administrativo del Hospital
# Verapaz. Node.js LTS en modo ESM + Express + Prisma + PostgreSQL.
# Sprint 8: imagen para instalacion local en el hospital mediante Docker.
# Se ejecuta como usuario no root; las migraciones y el seed se aplican de
# forma controlada en el primer arranque (RUN_MIGRATIONS / RUN_SEED).
FROM node:22-alpine

# Prisma necesita openssl en Alpine
RUN apk add --no-cache openssl

WORKDIR /app

# Dependencias primero (capa cacheable); postinstall ejecuta prisma generate
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Codigo de la aplicacion
COPY prisma ./prisma
COPY src ./src
COPY scripts ./scripts

# Usuario no root, dueno de los volumenes de uploads y respaldos
RUN addgroup -S verapaz && adduser -S verapaz -G verapaz \
  && mkdir -p /app/uploads /app/backups \
  && chown -R verapaz:verapaz /app
USER verapaz

EXPOSE 4000

# Migraciones y seed controlados en el arranque, luego el servidor.
# - RUN_MIGRATIONS=true  aplica `prisma migrate deploy` (idempotente).
# - RUN_SEED=true        ejecuta el seed una sola vez de forma segura (upsert).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health | grep -q '"status":"ok"' || exit 1

CMD ["sh", "-c", "\
  if [ \"$RUN_MIGRATIONS\" = \"true\" ]; then npx prisma migrate deploy; fi; \
  if [ \"$RUN_SEED\" = \"true\" ]; then node prisma/seed.js; fi; \
  node src/server.js"]
