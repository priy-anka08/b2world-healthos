FROM node:20-slim
# Prisma's query engine needs OpenSSL; node:20-alpine ships an OpenSSL
# version Prisma's engine binary isn't built against (a known Prisma+musl
# incompatibility), so we use the Debian-based "slim" image instead.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
EXPOSE 4000
CMD ["npm", "run", "dev"]