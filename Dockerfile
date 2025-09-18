FROM node:lts-bookworm-slim

WORKDIR /app

EXPOSE 4200

RUN npm install -g @angular/cli

COPY . /app

RUN npm install

RUN ng build

CMD ["ng", "serve", "--host", "0.0.0.0", "--port", "4200", "--ssl", "true"]
