# Kosh Orbit Control

<p align="left">
  <img alt="Status" src="https://img.shields.io/badge/Status-Active_Development-ff9800?style=for-the-badge" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-First-3178C6?logo=typescript&logoColor=white&style=for-the-badge" />
  <img alt="Vue" src="https://img.shields.io/badge/Vue_3-4FC08D?logo=vue.js&logoColor=white&style=for-the-badge" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white&style=for-the-badge" />
  <img alt="Express" src="https://img.shields.io/badge/Express-API-000000?logo=express&logoColor=white&style=for-the-badge" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white&style=for-the-badge" />
  <img alt="Redis" src="https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white&style=for-the-badge" />
  <img alt="GCP" src="https://img.shields.io/badge/GCP-Cloud_Run_+_Firebase-4285F4?logo=googlecloud&logoColor=white&style=for-the-badge" />
</p>

## Overview
Kosh Orbit Control is a centralized command surface for a strict, production-oriented Google Cloud Platform architecture.

The platform consolidates:
- service governance
- observability and incident response
- support and CRM operations
- budget controls and auto-pause policies
- analytics and BI orchestration

Everything is designed around a TypeScript-first delivery model to keep contracts consistent across frontend, backend, worker services, and tooling.

## Product Status
This product is still in development and remains under active architecture and implementation cycles.

Current modules are functional, but the system is intentionally evolving toward a more rigorous multi-service control plane with stronger automation and policy enforcement.

## Core Stack
- Frontend: Vue 3, Vite, TypeScript, Pinia, Axios
- Backend: Express API, TypeScript-compatible service contracts
- Data: PostgreSQL (metrics and logs), Redis (queues and streams)
- Infra: Cloud Run, Firebase Hosting, Secret Manager, containerized workers

## Architecture Direction
1. Centralize service operations in one panel while preserving strict access controls.
2. Standardize runtime configuration using Google Secret Manager.
3. Keep workloads elastic and cost-aware with policy-driven scaling controls.
4. Expand project-level isolation and governance for multi-tenant operations.

## AI Video Generation Roadmap
The next major capability is AI-assisted video generation for product storytelling, support automation, and growth operations.

Planned pipeline:
- prompt-to-brief generation with typed scene schemas
- template-driven scene composition
- voiceover and subtitle automation
- asynchronous rendering queue with retry controls
- output distribution hooks for channel publishing

## Low-Cost AI Execution Strategy
The AI media layer is being designed for cost discipline from day one:
- burst-based compute activation only when jobs exist
- queue prioritization for business-critical renders
- preview-first workflow before full-quality exports
- cache reuse for repeated scenes and assets
- policy-based budget guardrails and automatic service throttling
- auto-pause of non-critical workloads when spending thresholds are reached

## Engineering Reality
This is a complex platform and still requires substantial analysis, architecture validation, and incremental hardening before full maturity.

The development roadmap prioritizes reliability, security, and predictable operating cost over rushed feature delivery.
