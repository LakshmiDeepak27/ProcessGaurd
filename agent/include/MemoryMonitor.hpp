#pragma once

#include "Monitor.hpp"
#include "SystemProbe.hpp"
#include <memory>
#include <cstdint>

namespace processguard {

/**
 * @brief MemoryMonitor tracks system memory metrics (total, used, available, percentage).
 * Inherits from Monitor base class.
 */
class MemoryMonitor : public Monitor {
public:
    explicit MemoryMonitor(std::shared_ptr<SystemProbe> probe);
    ~MemoryMonitor() override = default;

    bool collect() override;
    void reset() override;

    double getMemoryUsage() const { return m_memoryUsagePercent; }
    uint64_t getTotalMemoryMb() const { return m_totalMemoryMb; }
    uint64_t getUsedMemoryMb() const { return m_usedMemoryMb; }
    uint64_t getAvailableMemoryMb() const { return m_availableMemoryMb; }

    static double calculateUsagePercent(uint64_t totalKb, uint64_t availableKb);

private:
    std::shared_ptr<SystemProbe> m_probe;
    double m_memoryUsagePercent{0.0};
    uint64_t m_totalMemoryMb{0};
    uint64_t m_usedMemoryMb{0};
    uint64_t m_availableMemoryMb{0};
};

} // namespace processguard
