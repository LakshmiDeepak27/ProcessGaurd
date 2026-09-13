#include "CpuMonitor.hpp"
#include <algorithm>

namespace processguard {

static inline double clampVal(double v, double lo, double hi) {
    return (v < lo) ? lo : ((v > hi) ? hi : v);
}

CpuMonitor::CpuMonitor(std::shared_ptr<SystemProbe> probe)
    : m_probe(std::move(probe)) {}

double CpuMonitor::calculateUsage(uint64_t prevIdle, uint64_t prevTotal,
                                 uint64_t currIdle, uint64_t currTotal) {
    if (currTotal <= prevTotal) {
        return 0.0;
    }
    uint64_t totalDelta = currTotal - prevTotal;
    uint64_t idleDelta = (currIdle >= prevIdle) ? (currIdle - prevIdle) : 0;

    if (totalDelta == 0) return 0.0;
    double usage = 100.0 * (1.0 - (static_cast<double>(idleDelta) / static_cast<double>(totalDelta)));
    return clampVal(usage, 0.0, 100.0);
}

bool CpuMonitor::collect() {
    if (!m_probe) return false;

    CpuTicks currTicks;
    if (!m_probe->readCpuTicks(currTicks)) {
        return false;
    }

    if (!m_hasPrevTicks) {
        m_prevTicks = currTicks;
        m_hasPrevTicks = true;
        m_cpuUsage = 0.0;
        return true;
    }

    m_cpuUsage = calculateUsage(m_prevTicks.getIdle(), m_prevTicks.getTotal(),
                                currTicks.getIdle(), currTicks.getTotal());
    m_prevTicks = currTicks;
    return true;
}

void CpuMonitor::reset() {
    m_hasPrevTicks = false;
    m_cpuUsage = 0.0;
}

} // namespace processguard
