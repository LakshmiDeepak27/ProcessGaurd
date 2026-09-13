#pragma once

#include "Process.hpp"
#include "Snapshots.hpp"
#include <string>
#include <vector>
#include <unordered_map>
#include <cstdint>

namespace processguard {

struct AnomalyEvent {
    int pid{0};
    std::string processName;
    std::string eventType; // HIGH_CPU, CRITICAL_CPU, HIGH_MEMORY, CRITICAL_MEMORY, SUSTAINED_HIGH_CPU
    std::string severity;  // INFO, WARNING, CRITICAL
    double cpuUsage{0.0};
    double memoryUsage{0.0};
    std::string message;
    std::string timestamp;
};

/**
 * @brief ProcessAnalyzer inspects processes and detects transient and sustained anomalies.
 * Tracks consecutive samples using std::unordered_map<int, int>.
 */
class ProcessAnalyzer {
public:
    ProcessAnalyzer(double cpuWarning = 80.0, double cpuCritical = 90.0,
                    double memWarning = 80.0, double memCritical = 90.0,
                    int sustainedSamplesThreshold = 3);
    ~ProcessAnalyzer() = default;

    /**
     * @brief Evaluates a process list and returns generated anomaly events.
     * Updates process risk levels (NORMAL, WARNING, CRITICAL).
     */
    std::vector<AnomalyEvent> analyze(std::vector<Process>& processes, const std::string& timestamp);

    void reset();

    // Threshold accessors
    double getCpuWarningThreshold() const { return m_cpuWarningThreshold; }
    double getCpuCriticalThreshold() const { return m_cpuCriticalThreshold; }
    double getMemWarningThreshold() const { return m_memWarningThreshold; }
    double getMemCriticalThreshold() const { return m_memCriticalThreshold; }
    int getSustainedSamplesThreshold() const { return m_sustainedSamplesThreshold; }

private:
    double m_cpuWarningThreshold{80.0};
    double m_cpuCriticalThreshold{90.0};
    double m_memWarningThreshold{80.0};
    double m_memCriticalThreshold{90.0};
    int m_sustainedSamplesThreshold{3};

    // Tracks PID -> consecutive samples above critical threshold
    std::unordered_map<int, int> m_consecutiveHighCpu;
};

} // namespace processguard
