# skyclad_langgraph

This project is a Turborepo workspace for a LangGraph agent backend and chat UI.

## Features

- **TypeScript** - For type safety and improved developer experience
- **LangGraph + LangChain** - Agent runtime and orchestration
- **Next.js** - Chat UI
- **Node.js** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

## Database Setup

This project uses PostgreSQL with Drizzle ORM.

1. Make sure you have a PostgreSQL database set up.
2. Update your `apps/react-agent-js/.env` file with your PostgreSQL connection details.

3. Apply the schema to your database:

```bash
pnpm run db:push
```

Then, run development:

```bash
pnpm run dev
```

- Agent backend default runs from `apps/react-agent-js`
- Chat UI default runs from `apps/agent-chat-ui`

## Project Structure

```
skyclad_langgraph/
├── apps/
│   ├── react-agent-js/   # LangGraph agent backend
│   └── agent-chat-ui/    # Next.js chat UI
├── packages/
│   └── db/          # Database schema & queries
```

## Available Scripts

- `pnpm run dev`: Start all applications in development mode
- `pnpm run build`: Build all applications
- `pnpm run dev:react-agent-js`: Start only the agent backend
- `pnpm run dev:agent-chat-ui`: Start only the chat UI
- `pnpm run check-types`: Check TypeScript types across all apps
- `pnpm run db:push`: Push schema changes to database
- `pnpm run db:generate`: Generate database client/types
- `pnpm run db:migrate`: Run database migrations
- `pnpm run db:studio`: Open database studio UI
