# Simple Dockerfile for Next.js app
FROM node:18-alpine

WORKDIR /app

# Copy frontend files
COPY frontend/package*.json ./
RUN npm install

COPY frontend/ .

# Build the app
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
