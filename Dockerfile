FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install --production

COPY worker.js ./
COPY src ./src
COPY public ./public

ENV PORT=80

EXPOSE 80

CMD ["node", "src/app.js"]
