# Mycarwash.ph docs

Index for the Mycarwash.ph monorepo (River rules shape **A**: `frontend/` Next.js app plus
`backend/functions/` Express API on Cloud Functions). Read the doc for the area you touch before
changing code, and update it in the same change ([river-ai-rules](https://github.com/idealchop/river-ai-rules) 00-core §2).

| Doc | Read before changing |
| :--- | :--- |
| [architecture-overview.md](./architecture-overview.md) | FE/BE split, request path, feature flags, folders |
| [firestore_schema.md](./firestore_schema.md) | Firestore collections, fields, rules |
| [auth-flow.md](./auth-flow.md) | Sign-in, how the shop (tenant) is resolved, roles, admin claim |
| [environments.md](./environments.md) | Firebase project, databases, backends, env vars, deploy |
| [hybrid-read-model.md](./hybrid-read-model.md) | Any frontend Firestore read (there are none today) |
| [api.md](./api.md) | Shop API and the `/v1` River Mobile partner API |
| [ai-companion.md](./ai-companion.md) | AI Companion (chat, Monday tips, quota) |
| [custom-domain.md](./custom-domain.md) | mycarwash.ph domain setup |
| [production-checklist.md](./production-checklist.md) | Launch checklist |

Agent entry point: [../AGENTS.md](../AGENTS.md).
