FROM node:22-bookworm-slim AS web-build
ARG VITE_KODA_AUTH_ENABLED=false
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_KODA_AUTH_ENABLED=$VITE_KODA_AUTH_ENABLED \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package-lock.json ./apps/web/
RUN npm ci && npm --prefix apps/web ci
COPY apps/web ./apps/web
COPY content ./content
COPY scripts/sync-web-content.mjs ./scripts/sync-web-content.mjs
COPY scripts/generate-achievement-thumbnails.mjs ./scripts/generate-achievement-thumbnails.mjs
RUN npm --prefix apps/web run build

FROM python:3.12-slim-bookworm AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MPLCONFIGDIR=/tmp/matplotlib \
    KODA_DB_PATH=/data/koda.db
WORKDIR /app
COPY apps/api/requirements.txt ./apps/api/requirements.txt
RUN pip install --no-cache-dir -r apps/api/requirements.txt
COPY apps/api ./apps/api
COPY content ./content
COPY --from=web-build /app/apps/web/dist ./apps/web/dist
RUN mkdir -p /data && chown -R 10001:10001 /app /data
USER 10001
EXPOSE 10000
CMD ["sh","-c","uvicorn app.main:app --app-dir apps/api --host 0.0.0.0 --port ${PORT:-10000} --proxy-headers --forwarded-allow-ips='*'"]
