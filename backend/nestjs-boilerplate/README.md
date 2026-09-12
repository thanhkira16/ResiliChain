# 🚀 NestJS Boilerplate

> A clean, production-ready NestJS boilerplate with authentication, user management, and Clean Architecture.

---

## ✨ Features

- 🔐 **Auth & Roles** — JWT + Refresh Token, Google OAuth, Role-based access control
- � **User Management** — Register, login, profile, update, delete
- 🗄 **Database** — PostgreSQL + TypeORM + Migrations
- 🧩 **Developer Friendly** — TypeScript, ESLint, Prettier, Jest

---

## 📁 Folder Structure

```
src/
├── core/
│ ├── application/ # Use cases & services
│ ├── domain/ # Entities & repositories
│ └── common/ # DTOs, constants, exceptions
├── infrastructure/
│ ├── api/ # Controllers & modules
│ ├── persistence/ # TypeORM repositories
│ ├── common/ # Guards, filters, interceptors, decorators
│ └── config/ # App & DB configuration
├── app.module.ts
└── main.ts
```

---

## ⚡ Getting Started

### 1️⃣ Installation

```bash
git clone <repo-url>
cd nest-boilerplate
npm install
```

### 2️⃣ Environment Setup

Create `.env` file:

```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=your_username
DATABASE_PASSWORD=your_password
DATABASE_NAME=your_database
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
PORT=3000
```

### 3️⃣ Database Migration

```bash
npm run migration:run
```

### 4️⃣ Run App

```bash
npm run start:dev
```

Docs available at: http://localhost:3000/docs


---

## 🧪 Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Start in dev mode |
| `npm run build` | Build for production |
| `npm run test` | Run unit tests |
| `npm run lint` | Lint code |
| `npm run format` | Format with Prettier |
| `npm run migration:run` | Run DB migrations |

---

## � License

TienPham© 2025 — Built with ❤️ using NestJS
