# Production web image — one nginx serving three vhosts:
#   ruirufactorymabati.com        → billing admin UI + captive portal (+ /api → flask)
#   lumen.ruirufactorymabati.com  → Lumen marketing website (+ /api/website → flask)
#   demo.ruirufactorymabati.com   → self-contained interactive demo (no backend)

# ---------- stage 1: billing admin/portal (production build) ----------
FROM node:20-alpine AS frontend

WORKDIR /app
COPY FRONTEND/infora_billing/package.json FRONTEND/infora_billing/package-lock.json ./
RUN npm ci

COPY FRONTEND/infora_billing/ ./

ARG VITE_API_BASE_URL=https://ruirufactorymabati.com
ARG VITE_RADIUS_SERVER
ARG VITE_FREERADIUS_HOST
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_RADIUS_SERVER=${VITE_RADIUS_SERVER}
ENV VITE_FREERADIUS_HOST=${VITE_FREERADIUS_HOST}

RUN npm run build

# ---------- stage 2: interactive demo (same app, demo mode) ----------
# All /api calls are intercepted in-browser (src/demo) — needs no backend.
FROM node:20-alpine AS demo

WORKDIR /app
COPY FRONTEND/infora_billing/package.json FRONTEND/infora_billing/package-lock.json ./
RUN npm ci

COPY FRONTEND/infora_billing/ ./

ARG LUMEN_MARKETING_URL=https://lumen.ruirufactorymabati.com
ENV VITE_DEMO_MODE=true
ENV VITE_API_BASE_URL=
ENV VITE_MARKETING_URL=${LUMEN_MARKETING_URL}

RUN npm run build

# ---------- stage 3: Lumen marketing website ----------
# Vite 8 requires Node >= 20.19 / 22 — use node:22 to be safe.
FROM node:22-alpine AS lumen

WORKDIR /app
COPY LUMEN/lumen-website/package.json LUMEN/lumen-website/package-lock.json ./
RUN npm ci

COPY LUMEN/lumen-website/ ./

ARG LUMEN_SITE_URL=https://lumen.ruirufactorymabati.com
ARG LUMEN_APP_URL=https://ruirufactorymabati.com
ARG LUMEN_DEMO_URL=https://demo.ruirufactorymabati.com
# Marketing forms (contact / trial signup) post to the lumen vhost itself;
# nginx proxies /api/website/* through to Flask (same-origin, no CORS).
ENV VITE_APP_URL=${LUMEN_APP_URL}
ENV VITE_DEMO_URL=${LUMEN_DEMO_URL}
ENV VITE_API_BASE_URL=${LUMEN_SITE_URL}

RUN npm run build

# ---------- final: nginx ----------
FROM nginx:1.25-alpine

COPY config/nginx/nginx.conf /etc/nginx/nginx.conf
COPY config/nginx/snippets/ /etc/nginx/snippets/
COPY config/nginx/conf.d/ /etc/nginx/conf.d/
COPY --from=frontend /app/dist /usr/share/nginx/html
COPY --from=demo /app/dist /usr/share/nginx/demo
COPY --from=lumen /app/dist /usr/share/nginx/lumen

RUN mkdir -p /var/www/certbot

EXPOSE 80 443
