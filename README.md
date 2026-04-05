# Kosh Control Plane

<p align="left">
  <img alt="Status" src="https://img.shields.io/badge/status-under%20development-orange" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-core-3178C6?logo=typescript&logoColor=white" />
  <img alt="Vue 3" src="https://img.shields.io/badge/Vue_3-4FC08D?logo=vue.js&logoColor=white" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white" />
  <img alt="Pinia" src="https://img.shields.io/badge/Pinia-state-F7D336?logo=vue.js&logoColor=black" />
  <img alt="Express" src="https://img.shields.io/badge/Express-API-000000?logo=express&logoColor=white" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" />
  <img alt="Redis" src="https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white" />
  <img alt="Cloud Run" src="https://img.shields.io/badge/GCP-Cloud_Run-4285F4?logo=googlecloud&logoColor=white" />
  <img alt="Firebase Hosting" src="https://img.shields.io/badge/Firebase-Hosting-FFCA28?logo=firebase&logoColor=black" />
</p>

## 🚧 Product Stage

This platform is currently in active development.

Kosh Control Plane is a centralized operations system for a rigid, production-grade GCP architecture.  
The objective is to unify observability, support operations, deployment governance, cost controls, and analytics into a single TypeScript-first experience.

## 🎯 Why This Platform Exists

- Consolidate multiple operational surfaces into one control plane.
- Enforce strict infrastructure patterns on GCP (Cloud Run + managed routing + secured secrets).
- Keep engineering velocity high while maintaining strong reliability controls.
- Use TypeScript end-to-end for consistency, faster iteration, and safer refactoring.

## 🧱 Architecture Focus

### Frontend
- Vue 3 + Vite + TypeScript
- Pinia state management
- Axios-based API orchestration

### Backend
- Express (TypeScript-oriented roadmap and interfaces)
- PostgreSQL (metrics/logs domains)
- Redis (queues, keys, event streams)

### Infrastructure
- Google Cloud Run for stateless services
- Firebase Hosting as frontend edge/router
- Secret-driven runtime configuration (Secret Manager model)
- VM-supported data services with controlled resource footprint

## 🧠 AI Video Generation Roadmap

Planned AI capabilities include automated video generation pipelines for growth, support, and product communication:

- Script-to-video orchestration (prompt + structured scene plan).
- Dynamic scene assembly using reusable templates.
- Branded overlays and voice tracks generated from structured metadata.
- Event-driven rendering jobs with queue-based concurrency.

### Cost-Optimized AI Video Strategy

The implementation is being designed for low-cost, high-scale execution:

- Asynchronous rendering with queue prioritization.
- Burst compute only when needed (no always-on GPU assumptions).
- Tiered quality modes (draft vs production output).
- Scene/template caching to avoid redundant inference.
- Progressive render strategy (short previews before full export).
- Budget-aware throttling and policy-based auto-pausing for non-critical workloads.

## 📌 Engineering Notes

- This is a complex platform and requires significant analysis, architecture validation, and iterative implementation.
- Several modules are already operational; others are being hardened for long-term production reliability.
- Security posture is strict: no credentials should be committed; runtime secrets are injected by environment and cloud secret layers.

## 🔭 Current Direction

- Continue integrating service orchestration and auto-cost controls.
- Expand support/CRM/analytics integrations behind unified project context.
- Ship the first end-to-end AI video generation flow with budget guardrails.

