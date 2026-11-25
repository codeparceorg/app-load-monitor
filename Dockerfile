
FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY server.js worker.js ./

COPY public ./public

ENV PORT=80

EXPOSE 80

CMD ["node", "server.js"]