FROM oven/bun:1.3.13-alpine AS builder

ARG ENV_FILE=.env.production.local

WORKDIR /builder

COPY package.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN bun i

COPY . .

RUN cp client/$ENV_FILE client/.env && \
    cp server/$ENV_FILE server/.env && \
    rm -f client/.env.* server/.env.*

RUN cd client && bun run build
RUN cd server && bun run build

FROM alpine:3.22

RUN apk add libgcc libstdc++

WORKDIR /runner

COPY --from=builder /builder/client/out /runner/client
COPY --from=builder /builder/server/bin /runner/bin
COPY --from=builder /builder/server/.env /runner/.env

EXPOSE 3000

CMD ["./bin"]
