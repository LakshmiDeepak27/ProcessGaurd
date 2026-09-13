#pragma once

#include <string>
#include <vector>
#include <cstdint>
#include "Process.hpp"

namespace processguard {

struct SystemSnapshot {
    double cpuUsage{0.0};
    double memoryUsage{0.0};
    uint64_t totalMemoryMb{0};
    uint64_t usedMemoryMb{0};
    uint64_t availableMemoryMb{0};
    uint64_t uptime{0};
    int processCount{0};
    std::string timestamp;
};

struct ProcessSnapshot {
    std::vector<Process> processes;
    std::string timestamp;
};

} // namespace processguard
