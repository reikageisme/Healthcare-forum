# syntax=docker/dockerfile:1
# Base stage
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com
RUN --mount=type=cache,target=/root/.npm \
    npm install --prefer-offline --no-audit --no-fund --maxsockets 5 --fetch-retries 5 --fetch-retry-mintimeout 20000 --fetch-retry-maxtimeout 120000

# Dev stage
# VITE_APP đến từ `environment` của compose lúc chạy, nên một image dev dùng
# được cho cả cổng tin tức lẫn diễn đàn.
FROM base AS dev
COPY . .
EXPOSE 3000 4000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Build stage
#
# Vite nướng biến VITE_* thẳng vào bundle lúc dựng, nên chúng phải là ARG chứ
# không thể là biến môi trường lúc chạy container: mỗi bản dựng là một trang.
FROM base AS build
ARG VITE_APP=portal
ARG VITE_PORTAL_URL=
ARG VITE_FORUM_URL=
ENV VITE_APP=${VITE_APP} \
    VITE_PORTAL_URL=${VITE_PORTAL_URL} \
    VITE_FORUM_URL=${VITE_FORUM_URL}
COPY . .
RUN npm run build

# Prod stage
# NGINX_CONF quyết định trang này nghe cổng nào: nginx.conf (3000, cổng tin
# tức) hay nginx.forum.conf (4000, diễn đàn).
FROM nginx:alpine AS prod
ARG NGINX_CONF=nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY ${NGINX_CONF} /etc/nginx/conf.d/default.conf
EXPOSE 3000 4000
CMD ["nginx", "-g", "daemon off;"]
