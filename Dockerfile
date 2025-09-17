FROM node:20-alpine
WORKDIR /app

# Install frontend deps
COPY package.json package-lock.json ./
RUN npm ci --platform=linux --arch=arm64

# Copy sources
COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev"]