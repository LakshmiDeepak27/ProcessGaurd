#pragma once

#include "Monitor.hpp"
#include "CpuMonitor.hpp"
#include "MemoryMonitor.hpp"
#include "ProcessMonitor.hpp"
#include "Snapshots.hpp"
#include "SystemProbe.hpp"
#include <memory>

namespace processguard {

/**
 * @brief SystemMonitor orchestrates subsystems through OOP Composition.
 * Contains CpuMonitor, MemoryMonitor, and ProcessMonitor.
 */
class SystemMonitor : public Monitor {
public:
    SystemMonitor();
    explicit SystemMonitor(std::shared_ptr<SystemProbe> probe);
    ~SystemMonitor() override = default;

    bool collect() override;
    void reset() override;

    SystemSnapshot getSystemSnapshot() const;
    ProcessSnapshot getProcessSnapshot() const;

    const CpuMonitor& getCpuMonitor() const { return *m_cpuMonitor; }
    const MemoryMonitor& getMemoryMonitor() const { return *m_memoryMonitor; }
    const ProcessMonitor& getProcessMonitor() const { return *m_processMonitor; }

    ProcessMonitor& getProcessMonitorMut() { return *m_processMonitor; }

private:
    std::shared_ptr<SystemProbe> m_probe;
    std::unique_ptr<CpuMonitor> m_cpuMonitor;
    std::unique_ptr<MemoryMonitor> m_memoryMonitor;
    std::unique_ptr<ProcessMonitor> m_processMonitor;
};

} // namespace processguard
