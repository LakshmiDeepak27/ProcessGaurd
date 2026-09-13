#include "MemoryMonitor.hpp"
#include <algorithm>

namespace processguard {

static inline double clampVal(double v, double lo, double hi) {
    return (v < lo) ? lo : ((v > hi) ? hi : v);
}

MemoryMonitor::MemoryMonitor(std::shared_ptr<SystemProbe> probe)
    : m_probe(std::move(probe)) {}

double MemoryMonitor::calculateUsagePercent(uint64_t totalKb, uint64_t availableKb) {
    if (totalKb == 0) return 0.0;
    if (availableKb >= totalKb) return 0.0;
    uint64_t usedKb = totalKb - availableKb;
    double percent = (static_cast<double>(usedKb) / static_cast<double>(totalKb)) * 100.0;
    return clampVal(percent, 0.0, 100.0);
}

bool MemoryMonitor::collect() {
    if (!m_probe) return false;

    MemMetrics metrics;
    if (!m_probe->readMemMetrics(metrics)) {
        return false;
    }

    m_totalMemoryMb = metrics.totalKb / 1024;
    m_availableMemoryMb = metrics.availableKb / 1024;
    m_usedMemoryMb = (m_totalMemoryMb > m_availableMemoryMb) ? (m_totalMemoryMb - m_availableMemoryMb) : 0;
    m_memoryUsagePercent = calculateUsagePercent(metrics.totalKb, metrics.availableKb);

    return true;
}

void MemoryMonitor::reset() {
    m_memoryUsagePercent = 0.0;
    m_totalMemoryMb = 0;
    m_usedMemoryMb = 0;
    m_availableMemoryMb = 0;
}

} // namespace processguard
