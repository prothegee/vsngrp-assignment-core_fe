FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG GIT_SHA=dev
RUN mkdir -p public && \
    VERSION=$(node -p "require('./package.json').version") && \
    printf '{"status":"ok","version":"%s","gitSha":"%s"}\n' "$VERSION" "$GIT_SHA" > public/health

ARG VITE_API_BASE_URL=http://localhost:9001
ARG VITE_WS_BASE_URL=ws://localhost:9002
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_WS_BASE_URL=${VITE_WS_BASE_URL}

RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 9003
