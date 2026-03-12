FROM node:18-alpine

# Install yt-dlp and ffmpeg
RUN apk add --no-cache py3-pip ffmpeg && \
    pip3 install --no-cache-dir yt-dlp

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Copy source code
COPY . .

# Create temp directory
RUN mkdir -p .temp_media

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the server
CMD ["npm", "start"]
