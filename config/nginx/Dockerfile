# Production web: build React admin/portal + Nginx reverse proxy
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

FROM nginx:1.25-alpine

COPY config/nginx/nginx.conf /etc/nginx/nginx.conf
COPY config/nginx/snippets/ /etc/nginx/snippets/
COPY config/nginx/conf.d/ /etc/nginx/conf.d/
COPY --from=frontend /app/dist /usr/share/nginx/html

RUN mkdir -p /var/www/certbot

EXPOSE 80 443
