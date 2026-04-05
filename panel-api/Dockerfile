FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN apk add --no-cache python3 make g++ bash
RUN npm install --production
COPY . .
EXPOSE 8080
ENV PORT=8080
CMD ["node", "index.js"]
