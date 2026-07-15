# Stapke Quiz App

A Next.js quiz app backed by [Appwrite](https://appwrite.io). Creators sign up and build quizzes; friends join as guests with a quiz code and display name (Kahoot-style).

## Stack

- **Next.js 15** (App Router) + TypeScript + Tailwind CSS
- **Appwrite** project: `stapkedennis`
- **Endpoint:** `https://fra.cloud.appwrite.io/v1`

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example env file and fill in your values:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=stapkedennis
NEXT_PUBLIC_APPWRITE_DATABASE_ID=your_database_id
NEXT_PUBLIC_APPWRITE_QUIZZES_TABLE_ID=your_quizzes_table_id
NEXT_PUBLIC_APPWRITE_QUESTIONS_TABLE_ID=your_questions_table_id
NEXT_PUBLIC_APPWRITE_PARTICIPANTS_TABLE_ID=your_participants_table_id
APPWRITE_API_KEY=your_server_api_key
```

### 3. Appwrite Console setup

Open [Appwrite Console](https://cloud.appwrite.io) and select project **stapkedennis**.

> **Shortcut:** If you have an API key, you can create all tables automatically:
>
> ```bash
> # Add APPWRITE_API_KEY to .env.local first, then:
> npm run setup:tables
> ```

#### Enable authentication

1. Go to **Auth** → **Settings**
2. Enable **Email/Password**

#### Add web platform

1. Go to **Overview** → **Platforms** (or **Settings** → **Platforms**)
2. Add a **Web** platform
3. Set hostname to `localhost` for local development
4. Add your production hostname when you deploy

#### Create database and tables

1. Go to **Databases** → create a database named `stapke`
2. Note the **Database ID** → set `NEXT_PUBLIC_APPWRITE_DATABASE_ID`

Create three tables inside that database:

**Table: `quizzes`**

| Column        | Type         | Required | Notes                          |
|---------------|--------------|----------|--------------------------------|
| `title`       | varchar(255) | Yes      | Quiz name                      |
| `code`        | varchar(8)   | Yes      | Unique join code               |
| `creatorId`   | varchar(36)  | Yes      | Appwrite user ID               |
| `status`      | varchar(20)  | Yes      | `draft`, `active`, or `closed` |
| `description` | text         | No       | Optional description           |

**Table: `questions`**

| Column   | Type    | Required | Notes                                      |
|----------|---------|----------|--------------------------------------------|
| `quizId` | varchar(36) | Yes  | Parent quiz row ID                         |
| `text`   | text    | Yes      | Question prompt                            |
| `order`  | integer | Yes      | Display order (0, 1, 2, …)                 |
| `options`| longtext| Yes      | JSON: `[{"text":"...","isCorrect":true}]`  |

**Table: `participants`**

| Column         | Type         | Required | Notes                    |
|----------------|--------------|----------|--------------------------|
| `quizId`       | varchar(36)  | Yes      | Quiz they joined         |
| `displayName`  | varchar(100) | Yes      | Guest display name       |
| `sessionToken` | varchar(64)  | Yes      | Random session token     |

Copy each **Table ID** into the matching env variable.

#### Set table permissions

**`quizzes` and `questions`** — creators manage their own data:

- **Create:** Users (authenticated)
- **Read / Update / Delete:** add a rule so users can only access rows where `creatorId` equals their user ID

In the Appwrite Console permissions UI, use a condition like:

```
creatorId = {{$userId}}
```

(Exact UI may vary by Appwrite version; the intent is row-level access per creator.)

**`participants`** — no direct client access:

- Do **not** grant create/read/update/delete to `Users` or `Any`
- Guest joins go through the Next.js `/api/join` route using the server API key

#### Create API key

1. Go to **Overview** → **API Keys** → **Create API key**
2. Name it e.g. `stapke-server`
3. Grant scopes for database read + write (TablesDB / Databases)
4. Copy the key → set `APPWRITE_API_KEY` in `.env.local` (never commit this)

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

1. **Register** → create an account
2. **Dashboard** → **New quiz** → add questions and save
3. Copy the **6-character join code** from the dashboard
4. Friends open **Join a quiz**, enter the code + display name
5. They land on the play lobby (live gameplay is the next phase)

## Project structure

```
src/
├── app/
│   ├── (auth)/login, register
│   ├── dashboard/
│   ├── quiz/new, quiz/[id]/edit
│   ├── join/
│   ├── play/[quizId]/
│   └── api/join/
├── components/
├── lib/
│   ├── appwrite/   # client + server SDK setup
│   ├── auth.ts
│   ├── quiz.ts
│   └── types.ts
└── middleware.ts   # protects /dashboard and /quiz/*
```

## Scripts

| Command        | Description          |
|----------------|----------------------|
| `npm run dev`  | Start dev server     |
| `npm run build`| Production build     |
| `npm run start`| Start production app |
| `npm run lint` | Run ESLint           |

## Deployment

### Live app

- **Frontend (GitHub Pages):** https://denni-b.github.io/stapke/
- **API backend (Render):** https://stapke.onrender.com

GitHub Pages serves the static UI. API requests are proxied to Render via a service worker, because GitHub Pages cannot run Next.js API routes.

### One-time setup after push

1. **GitHub Pages** — enable in repo **Settings → Pages → Build and deployment → GitHub Actions** (workflow `Deploy Stapke`).
2. **Render API** — connect the repo at [render.com](https://render.com), create a Web Service from `render.yaml`, and add the env vars from `.env.local.example` (including `APPWRITE_API_KEY`).
3. **Appwrite web platform** — in Appwrite Console add hostname `denni-b.github.io` under **Platforms → Web**.

Pushes to `main` rebuild and deploy GitHub Pages automatically.

## What's next

This MVP covers auth, quiz CRUD, and guest join. Not yet implemented:

- Live question-by-question gameplay
- Host controls (start quiz, next question)
- Scoring and leaderboards
- Real-time sync (Appwrite Realtime)
