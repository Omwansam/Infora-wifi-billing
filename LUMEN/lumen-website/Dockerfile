# Dev image — Vite dev server with hot reload (used by the `dev` profile in
# docker-compose.yml; production builds happen in config/nginx/Dockerfile).
# Vite 8 requires Node >= 20.19 / 22.
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5175

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5175"]
