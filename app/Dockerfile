FROM node:20-alpine

WORKDIR /usr/src/app

COPY package.json .
RUN npm install --legacy-peer-deps

COPY . .

ENV EXPO_NO_DOCTOR=1
ENV EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0
EXPOSE 19000 19001 19002 19006

CMD ["npm", "run", "web"]
