# Use Node.js 22 Alpine (LTS) for a small footprint
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files first to leverage cache
COPY package.json package-lock.json ./

# Install production dependencies
# Note: Since the worker setup might have devDependencies needed for build (unlikely here as it's raw JS), 
# we usually install all or just prod. Here we need @whatwg-node/server which is in dependencies.
RUN npm install --omit=dev

# Copy application source code
COPY . .

# Expose the port
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
