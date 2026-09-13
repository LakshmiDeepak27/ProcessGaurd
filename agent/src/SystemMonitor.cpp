#include "SystemMonitor.hpp"
#include <chrono>
#include <iomanip>
#include <sstream>

namespace processguard {

static std::string getCurrentIsoTimestamp() {
    auto now = std::chrono::system_clock::now();
    auto in_time_t = std::chrono::system_clock::to_time_t(now);
    std::stringstream ss;
    ss << std::put_time(std::gmtime(&in_time_t), "%Y-%m-%dT%H:%M:%SZ");
    return ss.str();
}

SystemMonitor::SystemMonitor()
    : SystemMonitor(std::make_shared<SystemProbe>()) {}

SystemMonitor::SystemMonitor(std::shared_ptr<SystemProbe> probe)
    : m_probe(std::move(probe)),
      m_cpuMonitor(std::make_unique<CpuMonitor>(m_probe)),
      m_memoryMonitor(std::make_unique<MemoryMonitor>(m_probe)),
      m_processMonitor(std::make_unique<ProcessMonitor>(m_probe)) {}

bool SystemMonitor::collect() {
    bool cpuOk = m_cpuMonitor->collect();
    bool memOk = m_memoryMonitor->collect();
    bool procOk = m_processMonitor->collect();
    return cpuOk && memOk && procOk;
}

void SystemMonitor::reset() {
    m_cpuMonitor->reset();
    m_memoryMonitor->reset();
    m_processMonitor->reset();
}

SystemSnapshot SystemMonitor::getSystemSnapshot() const {
    SystemSnapshot snapshot;
    snapshot.cpuUsage = m_cpuMonitor->getCpuUsage();
    snapshot.memoryUsage = m_memoryMonitor->getMemoryUsage();
    snapshot.totalMemoryMb = m_memoryMonitor->getTotalMemoryMb();
    snapshot.usedMemoryMb = m_memoryMonitor->getUsedMemoryMb();
    snapshot.availableMemoryMb = m_memoryMonitor->getAvailableMemoryMb();
    snapshot.uptime = m_probe ? m_probe->readUptime() : 0;
    snapshot.processCount = m_processMonitor->getProcessCount();
    snapshot.timestamp = getCurrentIsoTimestamp();
    return snapshot;
}

ProcessSnapshot SystemMonitor::getProcessSnapshot() const {
    ProcessSnapshot snapshot;
    snapshot.processes = m_processMonitor->getProcesses();
    snapshot.timestamp = getCurrentIsoTimestamp();
    return snapshot;
}

} // namespace processguard
