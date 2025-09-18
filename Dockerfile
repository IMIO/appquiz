FROM node:lts-bookworm-slim

WORKDIR /app

# Expose both frontend and backend ports
EXPOSE 4200 3000

RUN npm install -g @angular/cli

COPY package*.json ./

RUN npm install

COPY . .

# Install concurrently for running both servers
RUN npm install -g concurrently

# Use the dev script to start both Angular and Node.js servers
CMD ["npm", "run", "dev"]
