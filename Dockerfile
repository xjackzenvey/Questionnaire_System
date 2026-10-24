FROM node:22-alpine AS build
WORKDIR /app
ARG APP_BASE_PATH=/
ENV APP_BASE_PATH=$APP_BASE_PATH
COPY package*.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY src ./src
COPY public ./public
COPY shared ./shared
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3001
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY shared ./shared
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3001'+(process.env.APP_BASE_PATH||'').replace(/\/$/,'')+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]
