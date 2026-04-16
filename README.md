# Lethal Hub

Plataforma web para gerenciamento de obras como animes, séries, filmes, mangás, novels e jogos, permitindo acompanhar progresso, capítulos, notas, favoritos e status personalizados.

O projeto foi desenvolvido com foco em organização pessoal e estudo de arquitetura full stack, incluindo autenticação de usuários, backup em nuvem, sincronização automática entre dispositivos e persistência local para uso mais rápido e seguro.

## Tecnologias

### Frontend
- React
- TypeScript
- Vite
- Context API
- CSS customizado
- LocalStorage

### Backend
- Node.js
- Express
- MongoDB
- Mongoose
- JWT
- Bcrypt

### Deploy
- Frontend: Vercel  
- Backend: Render  

---

## Demonstração

A aplicação está disponível em:

https://lethal-hub.vercel.app/app

Existe um usuário de demonstração para testes.

> Observação:
- Usuários de demonstração possuem algumas limitações
- Funcionalidades sensíveis (como backup em nuvem) podem estar restritas
- Dados podem ser resetados periodicamente

---

## Funcionalidades

- Login e cadastro com autenticação JWT
- Sistema de favoritos
- Filtros, ordenação e pesquisa
- Controle de progresso e capítulos
- Backup em nuvem
- Sincronização automática entre dispositivos
- Suporte a uso local e online
- Interface responsiva adaptada para desktop e mobile
- Tema dark com foco em usabilidade

---

## Como rodar o projeto localmente

### Backend
    cd obras-backend
    npm install
    npm run dev

### Frontend
    cd obras-frontend
    npm install
    npm run dev

## Autor

Projeto desenvolvido por **Rafael R. Oliveira**  
GitHub: https://github.com/RafaelROliveira
