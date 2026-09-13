#pragma once

#include "Monitor.hpp"
#include "Process.hpp"
#include "SystemProbe.hpp"
#include <vector>
#include <unordered_map>
#include <memory>
#include <queue>

namespace processguard {

/**
 * @brief ProcessMonitor monitors individual processes across the OS.
 * Demonstrates Monitor inheritance, std::vector, std::unordered_map, and priority queues.
 */
class ProcessMonitor : public Monitor {
public:
    explicit ProcessMonitor(std::shared_ptr<SystemProbe> probe);
    ~ProcessMonitor() override = default;

    bool collect() override;
    void reset() override;

    const std::vector<Process>& getProcesses() const { return m_processes; }
    int getProcessCount() const { return static_cast<int>(m_processes.size()); }

    // DSA Methods
    const Process* findByPid(int pid) const;
    std::vector<Process> searchByName(const std::string& query) const;
    std::vector<Process> getTopCpu(size_t k) const;
    std::vector<Process> getTopMemory(size_t k) const;

    void sortByCpu(bool descending = true);
    void sortByMemory(bool descending = true);

private:
    std::shared_ptr<SystemProbe> m_probe;
    std::vector<Process> m_processes;
    std::unordered_map<int, ProcessProcData> m_prevProcessMap;
    uint64_t m_prevSampleTotalTicks{0};
};

} // namespace processguard
