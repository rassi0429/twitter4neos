FROM node:16-alpine
WORKDIR /app
COPY package.json .
COPY package-lock.json .
COPY main.js .
RUN npm i
CMD ["node","main.js"]