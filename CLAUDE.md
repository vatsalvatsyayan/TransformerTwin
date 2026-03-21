# TransformerTwin — Claude Code Instructions

## Project Overview
TransformerTwin is a real-time Digital Twin of a Power Transformer — a web application for monitoring, anomaly detection, diagnostics, and predictive simulation. See `/docs/PRD.md` for full product specification.

## Documentation System (READ FIRST)
Before making ANY changes, read the relevant docs:

- **`/docs/PRD.md`** — Product Requirements Document. The single source of truth for what we're building.
- **`/docs/BACKEND_ARCHITECTURE.md`** — Backend design, API contracts, sensor simulator formulas, anomaly detection logic.
- **`/docs/FRONTEND_ARCHITECTURE.md`** — Component hierarchy, 3D model specs, chart design, theming.
- **`/docs/INTEGRATION_CONTRACT.md`** — WebSocket message schemas, REST API specs, shared types. Frontend and backend MUST conform to this.
- **`/docs/DOMAIN_GUIDE.md`** — Power transformer domain knowledge. Reference when naming things or implementing domain logic.
- **`/docs/PROGRESS.md`** — ✅ LIVING DOCUMENT. Shows what's done, what's in progress, what's next. **Read this first, update it after every session.**
- **`/docs/DECISIONS.md`** — Architecture decisions log. When you make a non-trivial choice, log it here with rationale.
- **`/docs/ISSUES.md`** — Known bugs, tech debt, open questions. Add issues as you find them.

## Tech Stack
- **Backend**: Python 3.11+, FastAPI, WebSockets, SQLite (aiosqlite), NumPy/SciPy, Pydantic, uvicorn
- **Frontend**: React 18, TypeScript, Vite, React Three Fiber, Recharts, Tailwind CSS
- **Communication**: WebSocket (real-time sensor data), REST API (historical data, simulation, config)

## Code Standards

### Python (Backend)
- Type hints on ALL functions (parameters and return types)
- Pydantic models for all data schemas
- Async functions for all I/O operations
- Docstrings on all public functions (Google style)
- Group imports: stdlib → third-party → local
- Use `logging` module, not print statements
- Constants in UPPER_SNAKE_CASE in a `constants.py` file
- Every magic number must have a named constant with a comment explaining WHY that value

### TypeScript (Frontend)
- Strict TypeScript — no `any` types
- Functional components with hooks only (no class components)
- Custom hooks prefixed with `use` (e.g., `useSensorData`, `useWebSocket`)
- Props interfaces defined and exported alongside components
- Tailwind for ALL styling — no inline styles, no CSS modules
- Memoize expensive computations and components that receive stable props
- Named exports (no default exports except for page-level components)

### Naming Conventions
- **Files**: kebab-case for all files (`sensor-simulator.py`, `health-score.tsx`)
- **Python**: snake_case for variables/functions, PascalCase for classes
- **TypeScript**: camelCase for variables/functions, PascalCase for components/interfaces/types
- **Sensor IDs**: UPPER_SNAKE_CASE matching PRD exactly (e.g., `TOP_OIL_TEMP`, `DGA_H2`)
- **API routes**: kebab-case (`/api/health-score`, `/api/sensor-data`)

### Domain Accuracy
- Use correct domain terminology from `/docs/DOMAIN_GUIDE.md`
- Sensor names, units, ranges MUST match the PRD tables exactly
- Duval Triangle zone names: PD, T1, T2, T3, D1, D2, DT (exactly)
- Alert severity levels: INFO, CAUTION, WARNING, CRITICAL (exactly)

## Git Practices
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- One logical change per commit
- Commit message references the feature (e.g., `feat(simulator): add thermal correlation model`)

## Testing
- Backend: pytest with async support (pytest-asyncio)
- Frontend: Vitest + React Testing Library
- Test sensor correlations produce physically realistic values
- Test anomaly detection catches injected faults
- Test Duval Triangle classification matches known gas samples

## Update Docs After Every Session
After completing work, ALWAYS:
1. Update `/docs/PROGRESS.md` — mark completed items, add new items discovered
2. Update `/docs/DECISIONS.md` — log any architecture decisions made
3. Update `/docs/ISSUES.md` — add any bugs or tech debt discovered
