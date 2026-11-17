# Imagem do servidor de exemplo do Open Labs Brasil.
#
# Só para teste local: nenhum dado real, e a imagem não é publicada em
# registro de imagens. O ambiente (certificados, registro e configuração) é
# gerado fora dela, com `pnpm ambiente:gerar`, e montado em /ambiente.
#
#   docker build -t open-labs-brasil/servidor-de-exemplo .
#   docker run --rm -p 8443:8443 -p 8444:8444 -p 8445:8445 \
#     -v "$PWD/ambiente-local/gerado:/ambiente:ro" open-labs-brasil/servidor-de-exemplo
#
# Veja docs/servidor-e-suite.md, seção "Contêiner".

FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY LICENSE ./
COPY especificacao/registro/participantes.schema.json especificacao/registro/participantes.schema.json
COPY comum ./comum
COPY servidor-de-exemplo ./servidor-de-exemplo

USER node
EXPOSE 8443 8444 8445
ENTRYPOINT ["node", "servidor-de-exemplo/principal.ts"]
CMD ["--config", "/ambiente/servidor.config.json"]
