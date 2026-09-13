#pragma once

#include <string>
#include <cstdint>

namespace processguard {

/**
 * @brief Encapsulates state and metrics of an operating system process.
 * Demonstrates Data Abstraction and Encapsulation.
 */
class Process {
private:
    int m_pid{0};
    int m_ppid{0};
    std::string m_name;
    double m_cpuUsage{0.0};
    double m_memoryUsage{0.0};
    uint64_t m_memoryRssKb{0};
    std::string m_state{"unknown"};
    uint64_t m_uptimeSeconds{0};
    std::string m_riskLevel{"NORMAL"};

public:
    Process() = default;
    Process(int pid, int ppid, std::string name, double cpu, double mem,
            uint64_t rssKb, std::string state, uint64_t uptimeSec = 0)
        : m_pid(pid), m_ppid(ppid), m_name(std::move(name)),
          m_cpuUsage(cpu), m_memoryUsage(mem), m_memoryRssKb(rssKb),
          m_state(std::move(state)), m_uptimeSeconds(uptimeSec),
          m_riskLevel("NORMAL") {}

    // Getters with const correctness
    int getPid() const { return m_pid; }
    int getPpid() const { return m_ppid; }
    const std::string& getName() const { return m_name; }
    double getCpuUsage() const { return m_cpuUsage; }
    double getMemoryUsage() const { return m_memoryUsage; }
    uint64_t getMemoryRssKb() const { return m_memoryRssKb; }
    const std::string& getState() const { return m_state; }
    uint64_t getUptimeSeconds() const { return m_uptimeSeconds; }
    const std::string& getRiskLevel() const { return m_riskLevel; }

    // Setters
    void setCpuUsage(double cpu) { m_cpuUsage = cpu; }
    void setMemoryUsage(double mem) { m_memoryUsage = mem; }
    void setRiskLevel(std::string risk) { m_riskLevel = std::move(risk); }
    void setState(std::string state) { m_state = std::move(state); }
};

} // namespace processguard
