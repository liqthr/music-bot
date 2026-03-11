FROM node:20-alpine

RUN apk add --no-cache python3 py3-pip ffmpeg
RUN pip3 install --break-system-packages yt-dlp

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY server.js .

EXPOSE 3001
CMD ["node", "server.js"]
