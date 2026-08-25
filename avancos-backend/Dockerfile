FROM node:20-alpine

# Python + dependências para matplotlib
RUN apk add --no-cache \
    python3 \
    py3-pip \
    py3-pillow \
    py3-numpy \
    freetype-dev \
    libpng-dev \
    && pip3 install --no-cache-dir matplotlib --break-system-packages \
    && python3 -c "import matplotlib; print('matplotlib OK:', matplotlib.__version__)" \
    && python3 -c "from PIL import Image; print('PIL OK')"

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Copia o script Python para a pasta dist
RUN cp src/relatorio/gerar_chart.py dist/relatorio/gerar_chart.py

# Testa o script Python no build
RUN echo '{"dados":[{"label":"Teste","valor":1}],"titulo":"Teste","colLabel":"Col"}' | python3 dist/relatorio/gerar_chart.py > /dev/null && echo "Chart script OK"

EXPOSE 3098

CMD ["node", "dist/main"]
