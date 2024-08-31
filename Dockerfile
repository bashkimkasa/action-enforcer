FROM node:20-slim
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
COPY config.yml ./
COPY lib ./lib
RUN npm ci --production
RUN npm cache clean --force
ENV NODE_ENV="production"
COPY . .
CMD [ "npm", "start" ]
