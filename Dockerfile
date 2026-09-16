FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Il build condivide il LXC con altre app: limita thread Rust e heap Node.
ENV NEXT_TELEMETRY_DISABLED=1 RAYON_NUM_THREADS=2
RUN NODE_OPTIONS=--max-old-space-size=1024 npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000 NEXT_TELEMETRY_DISABLED=1 DOCUMENT_OCR_ENABLED=true
RUN apk add --no-cache poppler-utils tesseract-ocr tesseract-ocr-data-ita tesseract-ocr-data-eng \
    && addgroup -S myai && adduser -S myai -G myai
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER myai
EXPOSE 3000
CMD ["node", "server.js"]
