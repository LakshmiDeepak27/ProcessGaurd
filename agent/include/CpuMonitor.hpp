#pragma once

#include "Monitor.hpp"
#include "SystemProbe.hpp"
#include <memory>
#include <cstdint>

namespace processguard {

/**
 * @brief CpuMonitor computes CPU utilization percentage.
 * Inherits from Monitor base class.
 */
class CpuMonitor : public Monitor {
public:
    explicit CpuMonitor(std::shared_ptr<SystemProbe> probe);
    ~CpuMonitor() override = default;

    bool collect() override;
    void reset() override;

    double getCpuUsage() const { return m_cpuUsage; }

    // Helper static method for unit tests
    static double calculateUsage(uint64_t prevIdle, uint64_t prevTotal,
                                 uint64_t currIdle, uint64_t currTotal);

private:
    std::shared_ptr<SystemProbe> m_probe;
    CpuTicks m_prevTicks{};
    bool m_hasPrevTicks{false};
    double m_cpuUsage{0.0};
};

} // namespace processguard
