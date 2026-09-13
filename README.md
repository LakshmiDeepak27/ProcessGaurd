# ProcessGuard

> **Detect. Analyze. Understand.**  
> A high-performance, C++-powered system process monitoring and anomaly detection platform.

[![C++17](https://img.shields.io/badge/C%2B%2B-17-00599C?style=flat&logo=c%2B%2B)](https://en.cppreference.com/w/cpp/17)
[![Express.js](https://img.shields.io/badge/Backend-Node.js%20%2F%20Express-339933?style=flat&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2F%20Vite-61DAFB?style=flat&logo=react)](https://react.dev/)
[![SQLite](https://img.shields.io/badge/Database-SQLite3-003B57?style=flat&logo=sqlite)](https://www.sqlite.org/)
[![Docker](https://img.shields.io/badge/Deployment-Docker%20Multi--Stage-2496ED?style=flat&logo=docker)](https://www.docker.com/)

---

## 1. Project Overview & Problem Statement

Standard task managers (such as Windows Task Manager or Linux `top`) provide fleeting, momentary snapshots of system metrics. While adequate for observing an instantaneous spike, they fail to provide:
1. **Sustained Behavior Analysis**: Distinguishing between brief, benign usage bursts and pathological resource locks.
2. **Deterministic Anomaly Detection**: Evaluating rule-based thresholds over consecutive evaluation samples.
3. **Persistent Audit History**: Maintaining an indexed, historical audit trail of abnormal process events in a structured database.

**ProcessGuard** bridges this gap. It features a native C++ engine that interfaces directly with the operating system's process table, continuously monitors resource consumption, detects multi-sample sustained anomalies, and exposes real-time telemetry through a RESTful Node.js API and a responsive React dashboard.

---

## 2. Why ProcessGuard is NOT a Task Manager Clone

| Feature | Generic Task Manager | ProcessGuard |
| :--- | :--- | :--- |
| **Primary Focus** | Momentary resource display | Sustained anomaly detection & incident forensics |
| **History & Telemetry** | Ephemeral (lost on exit) | Persisted chronologically in indexed SQLite database |
| **Anomaly Engine** | None (pure passive display) | Configurable multi-sample rule engine (e.g. sustained >90% CPU) |
| **Architecture** | Monolithic local GUI | Decoupled client-server architecture with REST API & C++ core |
| **Alert Management** | None | Stateful Alert Manager with automated deduplication & cooldowns |

---

## 3. High-Level Architecture

```
                    +------------------------------------+
                    |       React 18 + Vite SPA          |
                    |   (Overview, Processes, Alerts,    |
                    |       History, System Info)        |
                    +-----------------+------------------+
                                      |
                               HTTP / REST (JSON)
                                      |
                    +-----------------v------------------+
                    |       Node.js + Express API        |
                    |  - Background Telemetry Poller     |
                    |  - REST Endpoints & Error Handler  |
                    |  - Static Production Asset Host    |
                    +--------+------------------+--------+
                             |                  |
                       JSON via stdout      SQL Queries
                             |                  |
                    +--------v---------+   +----v--------+
                    |   C++ Monitoring |   |   SQLite    |
                    |      Engine      |   |  Database   |
                    |  (OOP + DSA)     |   +-------------+
                    +--------+---------+
                             |
                     Linux /proc Filesystem
                             |
                    +--------v---------+
                    |   Kernel Space   |
                    +------------------+
```

---

## 4. Technology Stack

- **Core Engine**: Modern C++17, STL, CMake (zero heavy external runtime libraries)
- **Backend API**: Node.js (v20+), Express 4, `sqlite3`, `cors`
- **Database**: SQLite with persistent relational schema and indexes
- **Frontend Dashboard**: React 18, Vite 5, Vanilla CSS with custom coffee/espresso design system
- **Deployment**: Docker Multi-Stage Container, Render Cloud Web Service (`render.yaml`)

---

## 5. C++ Engine Architecture & Core OOP Principles

The C++ engine is located under `agent/` and demonstrates strict Object-Oriented Programming (OOP) and modern C++17 best practices:

```
                         Monitor (Abstract Base)
                                    |
            +-----------------------+-----------------------+
            |                       |                       |
      CpuMonitor              MemoryMonitor           ProcessMonitor
            \                       |                      /
             +----------------------+---------------------+
                                    | (Composition)
                              SystemMonitor
                                    |
                             ProcessAnalyzer
                                    |
                              AlertManager
```

### OOP Principles Demonstrated

1. **Abstraction**:
   - `Monitor` (`agent/include/Monitor.hpp`) declares the pure virtual contract:
     ```cpp
     virtual bool collect() = 0;
     virtual void reset() = 0;
     ```
   - Callers interact with monitors through abstract interfaces without coupling to OS-specific internals.
2. **Encapsulation**:
   - `Process` (`agent/include/Process.hpp`) encapsulates private attributes (`m_pid`, `m_name`, `m_cpuUsage`, `m_memoryUsage`, `m_riskLevel`) with strict `const`-correct getters and validated setters.
3. **Inheritance & Polymorphism**:
   - `CpuMonitor`, `MemoryMonitor`, and `ProcessMonitor` inherit from `Monitor` and implement specialized data acquisition algorithms.
4. **Composition**:
   - `SystemMonitor` (`agent/include/SystemMonitor.hpp`) composes `std::unique_ptr<CpuMonitor>`, `std::unique_ptr<MemoryMonitor>`, and `std::unique_ptr<ProcessMonitor>`, demonstrating the "has-a" paradigm rather than bloated monolithic inheritance.
5. **Resource Acquisition Is Initialization (RAII)**:
   - Smart pointers (`std::unique_ptr`, `std::shared_ptr`), POSIX directory handle management, and standard C++ file streams eliminate memory leaks and dangling handles.

---

## 6. Data Structures & Algorithms (DSA)

The monitoring engine utilizes fundamental data structures purposefully:

1. **`std::vector<Process>`**:
   - Contiguous memory allocation maximizes CPU L1/L2 cache locality when iterating over process collections.
2. **`std::unordered_map<int, ProcessProcData>`**:
   - $O(1)$ amortized lookup for PID matching across sampling intervals to compute accurate per-process CPU deltas.
   - Also used in `ProcessAnalyzer` to track consecutive critical samples per PID.
3. **`std::priority_queue` (Min-Heap / Max-Heap extraction)**:
   - `ProcessMonitor::getTopCpu(size_t k)` uses a min-heap comparator `[](const Process& a, const Process& b) { return a.getCpuUsage() > b.getCpuUsage(); }` to extract the Top-K resource consumers in $O(N \log K)$ time, avoiding unnecessary $O(N \log N)$ sorting of the entire process list.
4. **`std::sort`**:
   - High-performance Introsort algorithm used when full column sorting (CPU, Memory, PID) is requested.
5. **`std::find_if` / String Matching**:
   - Fast predicate searching by PID or case-insensitive substring matching on process executable names.

---

## 7. Operating System (OS) Fundamentals

ProcessGuard genuinely inspects the operating system process table:

1. **`/proc/stat`**: Aggregates CPU ticks across `user`, `nice`, `system`, `idle`, `iowait`, `irq`, `softirq`, and `steal`. Utilization is computed via:
   $$\Delta \text{Idle} = \text{idle}_2 - \text{idle}_1$$
   $$\Delta \text{Total} = \text{total}_2 - \text{total}_1$$
   $$\text{CPU \%} = 100 \times \left(1 - \frac{\Delta \text{Idle}}{\Delta \text{Total}}\right)$$
2. **`/proc/meminfo`**: Parses `MemTotal`, `MemFree`, `MemAvailable`, `Buffers`, and `Cached` to determine true unallocated and cached physical memory.
3. **`/proc/[pid]/stat`**: Extracts PID, executable name, process state (`R` Running, `S` Sleeping, `D` Disk Sleep, `Z` Zombie, `T` Stopped), user time (`utime`), kernel time (`stime`), process start time, and Resident Set Size (`rss`).
4. **Process Lifetime**: Computed by deriving elapsed seconds between system uptime and process `starttime`.

*Note: For local cross-platform development on Windows, `SystemProbe` features a native Win32 fallback utilizing `GetSystemTimes`, `GlobalMemoryStatusEx`, and Toolhelp32 snapshots, while targeting Linux `/proc` in container and production builds.*

---

## 8. Database Management Systems (DBMS)

Persistent historical data is managed by SQLite:

### Schema Design (`backend/src/database/schema.sql`)

```sql
CREATE TABLE IF NOT EXISTS system_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cpu_usage REAL NOT NULL,
    memory_usage REAL NOT NULL,
    total_memory_mb INTEGER,
    used_memory_mb INTEGER,
    available_memory_mb INTEGER,
    process_count INTEGER NOT NULL,
    uptime INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS process_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    system_snapshot_id INTEGER,
    pid INTEGER NOT NULL,
    process_name TEXT NOT NULL,
    cpu_usage REAL NOT NULL,
    memory_usage REAL NOT NULL,
    rss_kb INTEGER DEFAULT 0,
    state TEXT NOT NULL,
    risk_level TEXT DEFAULT 'NORMAL',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (system_snapshot_id) REFERENCES system_snapshots(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pid INTEGER NOT NULL,
    process_name TEXT NOT NULL,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    cpu_usage REAL NOT NULL,
    memory_usage REAL NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Indexing & Optimization
- `idx_system_snapshots_created_at` on `system_snapshots(created_at)` for fast time-series queries.
- `idx_alerts_severity` on `alerts(severity)` for rapid alert categorization.
- `idx_process_snapshots_pid` on `process_snapshots(pid)` for historical process auditing.
- Parameterized SQL queries prevent SQL injection vulnerabilities.

---

## 9. Computer Networks (CN) Concepts

- **Client-Server Architecture**: The frontend React SPA is decoupled from the Express backend and communicates strictly over HTTP.
- **RESTful Endpoints**: Resources are mapped to standardized HTTP verbs (`GET`, `POST`) with standard status codes (`200 OK`, `201 Created`, `404 Not Found`, `500 Internal Server Error`).
- **Data Serialization**: Structured JSON formatted by the C++ engine, validated by Express, and consumed by the React UI.
- **Single-Origin Deployment**: In production, Express serves both static assets and API routes, eliminating CORS overhead and cross-site scripting attack vectors.

---

## 10. REST API Documentation

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service uptime, engine binary verification, platform diagnostics |
| `GET` | `/api/system` | Latest system metrics (CPU %, Memory %, Uptime, Process Count) |
| `GET` | `/api/processes` | Paginated process table (`?search=`, `?sort=`, `?order=`, `?risk=`, `?page=`) |
| `GET` | `/api/processes/top` | Top 5 CPU and Top 5 Memory consumers |
| `GET` | `/api/alerts` | Active anomalies and persisted historical incident logs (`?severity=`) |
| `GET` | `/api/history` | Chronological snapshots for trend graphing (`?limit=30`) |
| `POST` | `/api/monitor` | Triggers immediate C++ sampling and database persistence |

---

## 11. Anomaly Detection & Alert Rules

Configured inside `ProcessAnalyzer`:

1. **CPU Rules**:
   - CPU $> 80\%$ $\rightarrow$ `WARNING` (`HIGH_CPU`)
   - CPU $> 90\%$ sustained for 3 consecutive samples $\rightarrow$ `CRITICAL` (`CRITICAL_CPU`)
     *Example Message*: `"CPU usage remained above 90% for 3 consecutive samples."*
2. **Memory Rules**:
   - Memory $> 80\%$ $\rightarrow$ `WARNING` (`HIGH_MEMORY`)
   - Memory $> 90\%$ $\rightarrow$ `CRITICAL` (`CRITICAL_MEMORY`)
3. **Deduplication & Cooldown**:
   - `AlertManager` hashes `PID:event_type` and enforces a 30-second cooldown window to prevent alert flooding.

---

## 12. Local Setup Guide

### Prerequisites
- Node.js 18+ and npm
- CMake 3.15+ and C++17 compiler (GCC, Clang, or MinGW)

### Step 1: Clone Repository
```bash
git clone <your-repository-url>
cd ProcessGuard
```

### Step 2: Build C++ Engine
```bash
cmake -S agent -B agent/build
cmake --build agent/build --config Release
```

### Step 3: Setup Backend
```bash
cd backend
npm install
npm test
```

### Step 4: Setup Frontend
```bash
cd ../frontend
npm install
npm run build
```

### Step 5: Start Application
```bash
cd ../backend
npm start
```
Open [http://localhost:5000](http://localhost:5000) in your browser.

---

## 13. Docker Setup Guide

The application contains a multi-stage `Dockerfile` that compiles the C++ engine on Alpine Linux, builds the React frontend, and runs the Node.js backend.

### Build and Run with Docker Compose
```bash
docker compose up --build
```
Access the application at [http://localhost:5000](http://localhost:5000).

---

## 14. Production Deployment to Render

The repository includes a production-ready `render.yaml` specification.

### 1-Click Deployment Instructions
1. Push this repository to GitHub.
2. Log in to [Render](https://render.com/).
3. Click **New +** $\rightarrow$ **Blueprint**.
4. Select your `ProcessGuard` GitHub repository.
5. Render reads `render.yaml`, spins up the Docker Web Service, executes the multi-stage build, and issues a live HTTPS URL.

### Cloud Container Limitation Notice
> [!NOTE]
> The deployed ProcessGuard runs inside a secure Linux cloud container. It monitors the resource usage and processes of its own execution container, **not** the user's local personal computer remotely. For local hardware monitoring, run ProcessGuard locally.

---

## 15. Testing Suite & Verification

### C++ Unit Tests (`agent/tests/test_main.cpp`)
- `testCpuCalculation`: Verifies CPU percentage math across idle/total deltas.
- `testMemoryCalculation`: Verifies memory utilization percentage bounds.
- `testProcessSortingAndSearch`: Validates Introsort and case-insensitive searching.
- `testTopConsumerPriorityQueue`: Validates $O(N \log K)$ heap extraction.
- `testAnomalyDetectionRules`: Verifies threshold evaluation.
- `testSustainedCpuAnomalyDetection`: Asserts that 3 consecutive $>90\%$ samples trigger `CRITICAL_CPU`.
- `testAlertManagerDeduplication`: Verifies suppression of repeating alerts.

Execute C++ unit tests:
```bash
./agent/build/tests/engine_tests
# Or via CTest
ctest --test-dir agent/build --output-on-failure
```

### Backend Integration Tests (`backend/src/tests/api.test.js`)
- Verifies SQLite schema creation, primary keys, and indexes.
- Validates snapshot persistence and historical query retrieval.
- Validates C++ engine execution and JSON schema compliance.

Execute backend tests:
```bash
cd backend && npm test
```

---

## 17. License
Distributed under the MIT License.
