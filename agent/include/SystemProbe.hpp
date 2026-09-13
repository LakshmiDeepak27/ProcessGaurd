#pragma once

#include <string>
#include <vector>
#include <unordered_map>
#include <cstdint>
#include "Process.hpp"
#include "Snapshots.hpp"

namespace processguard {

struct CpuTicks {
    uint64_t user{0};
    uint64_t nice{0};
    uint64_t system{0};
    uint64_t idle{0};
    uint64_t iowait{0};
    uint64_t irq{0};
    uint64_t softirq{0};
    uint64_t steal{0};

    uint64_t getTotal() const {
        return user + nice + system + idle + iowait + irq + softirq + steal;
    }

    uint64_t getIdle() const {
        return idle + iowait;
    }
};

struct MemMetrics {
    uint64_t totalKb{0};
    uint64_t freeKb{0};
    uint64_t availableKb{0};
    uint64_t buffersKb{0};
    uint64_t cachedKb{0};
};

struct ProcessProcData {
    int pid{0};
    int ppid{0};
    std::string comm;
    char state{'?'};
    uint64_t utime{0};
    uint64_t stime{0};
    uint64_t starttime{0};
    uint64_t rssPages{0};
};

/**
 * @brief SystemProbe encapsulates OS-level telemetry gathering.
 * Targets Linux /proc filesystem, with graceful native Windows API support for local environments.
 */
class SystemProbe {
public:
    SystemProbe();
    ~SystemProbe() = default;

    // Direct /proc readers
    bool readCpuTicks(CpuTicks& outTicks, const std::string& procStatPath = "/proc/stat");
    bool readMemMetrics(MemMetrics& outMem, const std::string& procMemPath = "/proc/meminfo");
    uint64_t readUptime(const std::string& procUptimePath = "/proc/uptime");
    std::vector<ProcessProcData> readAllProcesses(const std::string& procDir = "/proc");

    static bool isLinuxProcAvailable(const std::string& procStatPath = "/proc/stat");

private:
    long m_clockTicksPerSec{100};
    long m_pageSizeKb{4};
};

} // namespace processguard
