# Folosește imaginea oficială Playwright pentru a avea toate dependențele
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

# Setează directorul de lucru în container
WORKDIR /app

# Copiază fișierele de pachete și instalează dependențele
COPY package*.json ./
RUN npm install

# Copiază tot restul codului sursă
COPY . .

# Expune portul intern al serverului webhook
EXPOSE 3000

# Comanda de start care folosește PM2 pentru a menține procesul activ
CMD ["npm", "run", "start:prod"]