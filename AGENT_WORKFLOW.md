# TransformerTwin — Agent Workflow Guide

## How This Works

This project uses a **document-driven, multi-persona workflow** with Claude Code. Instead of separate AI agents, you use **slash commands** that give Claude Code different personas, each with specific responsibilities and context.

---

---

## Daily Workflow

### Starting a Session
1. Open Claude Code
2. Run: `/update-docs scan the codebase and update all living documents`
3. This brings docs up to date and gives you (and Claude) context on where things stand

### Building Backend
Use the backend agent persona:
```
/backend Build the sensor simulator module — implement the thermal correlation model (load → winding temp → oil temp) with the formulas from the Backend Architecture doc. Start with Phase 1.3 from PROGRESS.md.
```

### Building Frontend
Use the frontend agent persona:
```
/frontend Build the 3D transformer model using React Three Fiber — implement the tank, core, windings, and bushings as described in the Frontend Architecture doc. Start with Phase 3.4 from PROGRESS.md.
```

### Reviewing Code
After building a chunk:
```
/review Review all files in /backend/src/simulator/ — check physics accuracy, type safety, and adherence to the architecture doc.
```

### Testing Integration
After both sides have code:
```
/integrate Run the WebSocket contract verification — start the backend, connect from frontend, verify message formats match the Integration Contract.
```

### Ending a Session
Always run before stopping:
```
/update-docs I just finished [describe what you did]. Update all living documents.
```

---

## Workflow for the Weekend Build

###Backend Foundation
```
/backend Set up the FastAPI project scaffolding with folder structure from Backend Architecture doc. Phase 1.1.
/backend Build shared Pydantic models and constants. Phase 1.2.
/backend Build the sensor simulator with thermal model. Phase 1.3.
/backend Build the fault injection state machine. Phase 1.4.
/review Review /backend/src/simulator/ for physics accuracy
/backend Set up SQLite schema and WebSocket endpoint. Phase 1.5-1.6.
/update-docs Saturday morning session complete.
```

### Backend Intelligence
```
/backend Build anomaly detection engine. Phase 2.1.
/backend Build DGA analysis and Duval Triangle. Phase 2.2.
/backend Build failure mode engine and health score. Phase 2.3-2.4.
/backend Build what-if simulation engine. Phase 2.5.
/review Review all backend intelligence modules
/update-docs Saturday afternoon session complete.
```

### Frontend Foundation
```
/frontend Set up Vite + React + TypeScript + Tailwind project. Phase 3.1.
/frontend Build WebSocket hook and state management. Phase 3.2.
/frontend Build the dashboard layout with dark theme. Phase 3.3.
/frontend Build the 3D transformer model. Phase 3.4.
/integrate Verify WebSocket connection between frontend and backend
/update-docs Sunday morning session complete.
```

###Frontend Intelligence + Polish
```
/frontend Build time-series charts with actual vs expected. Phase 4.1.
/frontend Build Duval Triangle SVG visualization. Phase 4.2.
/frontend Build alerts panel and FMEA cards. Phase 4.3-4.4.
/frontend Build what-if simulation panel. Phase 4.5.
/frontend Build historical playback. Phase 4.6.
/integrate Run full end-to-end scenario tests
/review Final review of entire codebase
/update-docs Sunday afternoon session complete. Project ready for demo.
```

---

## Tips

1. **Always start with `/update-docs`** — it gives Claude full context without reading the entire codebase
2. **One task per command** — don't ask the backend agent to do 5 things at once. Small, focused tasks produce better code.
3. **Review after each phase** — catching issues early saves time. The review agent often spots things the building agent missed.
4. **Trust the docs** — if there's a conflict between what you remember and what PROGRESS.md says, trust the doc. That's why we keep it updated.
5. **The Integration Contract is sacred** — if either side needs to change the API contract, update the doc FIRST, then change the code. Otherwise the other side breaks silently.
