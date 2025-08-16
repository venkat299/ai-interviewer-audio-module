FROM node:18-alpine
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY server.js .
COPY ../../packages ./packages
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server.js"]
