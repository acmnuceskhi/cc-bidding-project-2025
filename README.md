# CC Bidding Project (2025)

Team-based auction system. Teams from Round 1 are auctioned to houses using a bidding mechanism with real-time updates.

**Live Event:** November 18, 2025 (~2 hours) — **3 complete rounds executed successfully; 4th round start attempt failed (infinite loading)**  
**Project Status:** ✅ Feature-complete | ✅ Core bidding logic validated | ⚠️ Infrastructure issues documented  
**Documentation:** ✅ Finalized December 31, 2025

---

## 🔴 **CRITICAL: Read Before Deploying**

**Previous deployment (Heroku + MongoDB Mumbai) failed after 2-3 rounds due to geographic latency + connection pooling issues.**

**You MUST read these before next deployment:**

1. **[`INCIDENT_REPORT.md`](./docs/reference/INCIDENT_REPORT.md)** — Root cause analysis & what went wrong
2. **[`DEPLOYMENT.md`](./docs/ops/DEPLOYMENT.md)** — How to avoid the failure (region co-location, connection pooling)
3. **[`PERFORMANCE.md`](./docs/ops/PERFORMANCE.md)** — Code optimizations & load testing guide

**Quick Fix:** Deploy app + MongoDB in **same region** (us-east-1 for Render). Increase connection pooling from 10 → 50. Test with 6 concurrent users.

## Documentation

### **🔴 For Next Team (Start Here)**
- [`INCIDENT_REPORT.md`](./docs/reference/INCIDENT_REPORT.md) - Post-mortem, root causes, solutions, pre-deployment checklist
- [`DEPLOYMENT.md`](./docs/ops/DEPLOYMENT.md) - Critical infrastructure setup, troubleshooting
- [`PERFORMANCE.md`](./docs/ops/PERFORMANCE.md) - Code-level optimizations, load testing, monitoring

### **Development & Architecture**
- [`ONBOARDING.md`](./ONBOARDING.md) - Setup, installation, contribution guide
- [`PROJECT_FLOW.md`](./docs/reference/PROJECT_FLOW.md) - System logic, workflows, real-time architecture
- [`API.md`](./docs/reference/API.md) - Complete API endpoint reference
- [`tests/README.md`](./tests/README.md) - Test suite documentation
- [`src/scripts/README.md`](./src/scripts/README.md) - Utility scripts for data management

## Tech Stack

- Next.js 16 (App Router)
- MongoDB + TypeScript
- Socket.io (real-time updates)
- Jest (testing)
