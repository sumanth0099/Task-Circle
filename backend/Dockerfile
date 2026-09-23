FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# PORT is provided at runtime by Render — do NOT hardcode it here
EXPOSE 5000

CMD ["npm", "start"]
