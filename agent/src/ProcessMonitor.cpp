#include "ProcessMonitor.hpp"
#include <algorithm>
#include <queue>
#include <cctype>

namespace processguard {

static inline double clampVal(double v, double lo, double hi) {
    return (v < lo) ? lo : ((v > hi) ? hi : v);
}

ProcessMonitor::ProcessMonitor(std::shared_ptr<SystemProbe> probe)
    : m_probe(std::move(probe)) {}

bool ProcessMonitor::collect() {
    if (!m_probe) return false;

    // Read CPU total ticks to compute process CPU % over delta
    CpuTicks currCpuTicks;
    bool hasCpuTicks = m_probe->readCpuTicks(currCpuTicks);
    uint64_t currSampleTotalTicks = hasCpuTicks ? currCpuTicks.getTotal() : 0;
    uint64_t totalDelta = (currSampleTotalTicks > m_prevSampleTotalTicks) ? (currSampleTotalTicks - m_prevSampleTotalTicks) : 0;

    // Read total memory to calculate per-process memory %
    MemMetrics memMetrics;
    m_probe->readMemMetrics(memMetrics);
    uint64_t totalMemKb = (memMetrics.totalKb > 0) ? memMetrics.totalKb : 1;

    uint64_t systemUptime = m_probe->readUptime();

    auto rawProcs = m_probe->readAllProcesses();
    std::vector<Process> newProcesses;
    newProcesses.reserve(rawProcs.size());

    std::unordered_map<int, ProcessProcData> newPrevMap;
    newPrevMap.reserve(rawProcs.size());

    for (const auto& raw : rawProcs) {
        newPrevMap[raw.pid] = raw;

        double procCpu = 0.0;
        auto prevIt = m_prevProcessMap.find(raw.pid);
        if (prevIt != m_prevProcessMap.end() && totalDelta > 0) {
            uint64_t prevProcTicks = prevIt->second.utime + prevIt->second.stime;
            uint64_t currProcTicks = raw.utime + raw.stime;
            if (currProcTicks >= prevProcTicks) {
                uint64_t procDelta = currProcTicks - prevProcTicks;
                procCpu = (static_cast<double>(procDelta) / static_cast<double>(totalDelta)) * 100.0;
            }
        }
        procCpu = clampVal(procCpu, 0.0, 100.0);

        // Calculate memory %
        uint64_t rssKb = raw.rssPages * 4; // 4KB pages default
        double procMem = (static_cast<double>(rssKb) / static_cast<double>(totalMemKb)) * 100.0;
        procMem = clampVal(procMem, 0.0, 100.0);

        std::string stateStr = "sleeping";
        if (raw.state == 'R') stateStr = "running";
        else if (raw.state == 'S') stateStr = "sleeping";
        else if (raw.state == 'D') stateStr = "disk sleep";
        else if (raw.state == 'Z') stateStr = "zombie";
        else if (raw.state == 'T') stateStr = "stopped";

        uint64_t uptimeSec = 0;
        if (systemUptime > 0 && raw.starttime > 0) {
            uint64_t startSec = raw.starttime / 100;
            if (systemUptime > startSec) {
                uptimeSec = systemUptime - startSec;
            }
        }

        newProcesses.emplace_back(raw.pid, raw.ppid, raw.comm, procCpu, procMem, rssKb, stateStr, uptimeSec);
    }

    m_processes = std::move(newProcesses);
    m_prevProcessMap = std::move(newPrevMap);
    m_prevSampleTotalTicks = currSampleTotalTicks;

    return true;
}

void ProcessMonitor::reset() {
    m_processes.clear();
    m_prevProcessMap.clear();
    m_prevSampleTotalTicks = 0;
}

const Process* ProcessMonitor::findByPid(int pid) const {
    auto it = std::find_if(m_processes.begin(), m_processes.end(),
                           [pid](const Process& p) { return p.getPid() == pid; });
    if (it != m_processes.end()) {
        return &(*it);
    }
    return nullptr;
}

std::vector<Process> ProcessMonitor::searchByName(const std::string& query) const {
    std::vector<Process> matches;
    if (query.empty()) return m_processes;

    std::string lowerQuery = query;
    std::transform(lowerQuery.begin(), lowerQuery.end(), lowerQuery.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });

    for (const auto& proc : m_processes) {
        std::string lowerName = proc.getName();
        std::transform(lowerName.begin(), lowerName.end(), lowerName.begin(),
                       [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
        if (lowerName.find(lowerQuery) != std::string::npos) {
            matches.push_back(proc);
        }
    }
    return matches;
}

void ProcessMonitor::sortByCpu(bool descending) {
    std::sort(m_processes.begin(), m_processes.end(),
              [descending](const Process& a, const Process& b) {
                  return descending ? (a.getCpuUsage() > b.getCpuUsage())
                                    : (a.getCpuUsage() < b.getCpuUsage());
              });
}

void ProcessMonitor::sortByMemory(bool descending) {
    std::sort(m_processes.begin(), m_processes.end(),
              [descending](const Process& a, const Process& b) {
                  return descending ? (a.getMemoryUsage() > b.getMemoryUsage())
                                    : (a.getMemoryUsage() < b.getMemoryUsage());
              });
}

std::vector<Process> ProcessMonitor::getTopCpu(size_t k) const {
    if (m_processes.empty() || k == 0) return {};

    auto cmp = [](const Process& a, const Process& b) {
        return a.getCpuUsage() > b.getCpuUsage(); // min-heap on CPU
    };
    std::priority_queue<Process, std::vector<Process>, decltype(cmp)> minHeap(cmp);

    for (const auto& proc : m_processes) {
        if (minHeap.size() < k) {
            minHeap.push(proc);
        } else if (proc.getCpuUsage() > minHeap.top().getCpuUsage()) {
            minHeap.pop();
            minHeap.push(proc);
        }
    }

    std::vector<Process> result;
    result.reserve(minHeap.size());
    while (!minHeap.empty()) {
        result.push_back(minHeap.top());
        minHeap.pop();
    }
    std::reverse(result.begin(), result.end());
    return result;
}

std::vector<Process> ProcessMonitor::getTopMemory(size_t k) const {
    if (m_processes.empty() || k == 0) return {};

    auto cmp = [](const Process& a, const Process& b) {
        return a.getMemoryUsage() > b.getMemoryUsage(); // min-heap on Memory
    };
    std::priority_queue<Process, std::vector<Process>, decltype(cmp)> minHeap(cmp);

    for (const auto& proc : m_processes) {
        if (minHeap.size() < k) {
            minHeap.push(proc);
        } else if (proc.getMemoryUsage() > minHeap.top().getMemoryUsage()) {
            minHeap.pop();
            minHeap.push(proc);
        }
    }

    std::vector<Process> result;
    result.reserve(minHeap.size());
    while (!minHeap.empty()) {
        result.push_back(minHeap.top());
        minHeap.pop();
    }
    std::reverse(result.begin(), result.end());
    return result;
}

} // namespace processguard
