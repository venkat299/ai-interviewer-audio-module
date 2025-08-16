FROM node:18-alpine
WORKDIR /app
COPY package.json package.json
COPY tsconfig.json tsconfig.json
COPY vite.config.ts vite.config.ts
COPY index.html index.html
COPY src src
RUN npm install && npm run build
EXPOSE 5173
CMD ["npx","vite","preview","--host","0.0.0.0","--port","5173"]
