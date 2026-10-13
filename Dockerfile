FROM node:26-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:26-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001
ENV FOOD_DATA_DIR=/data
COPY package*.json ./
RUN npm ci --omit=dev && mkdir -p /data
COPY --from=build /app/server ./server
COPY --from=build /app/dist ./dist
EXPOSE 3001
CMD ["npm", "run", "start"]
