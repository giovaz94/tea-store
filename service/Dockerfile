FROM node:22-alpine AS builder

WORKDIR /usr/src/app

COPY package.json ./
COPY tsconfig.json ./
COPY /src ./src

RUN npm install
RUN npm run build

FROM node:22-alpine

WORKDIR /usr/src/app

COPY package.json ./
RUN npm install --only=production

COPY --from=builder /usr/src/app/dist ./dist

CMD ["node", "dist/src/index.js"]
