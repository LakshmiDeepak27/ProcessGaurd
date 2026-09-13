#include "ProcessAnalyzer.hpp"
#include <sstream>
#include <iomanip>
#include <unordered_set>

namespace processguard {

ProcessAnalyzer::ProcessAnalyzer(double cpuWarning, double cpuCritical,
                                 double memWarning, double memCritical,
                                 int sustainedSamplesThreshold)
    : m_cpuWarningThreshold(cpuWarning),
      m_cpuCriticalThreshold(cpuCritical),
      m_memWarningThreshold(memWarning),
      m_memCriticalThreshold(memCritical),
      m_sustainedSamplesThreshold(sustainedSamplesThreshold) {}

std::vector<AnomalyEvent> ProcessAnalyzer::analyze(std::vector<Process>& processes,
                                                   const std::string& timestamp) {
    std::vector<AnomalyEvent> events;
    std::unordered_set<int> currentPids;

    for (auto& proc : processes) {
        currentPids.insert(proc.getPid());
        bool isCritical = false;
        bool isWarning = false;

        // --- CPU Evaluation ---
        if (proc.getCpuUsage() >= m_cpuCriticalThreshold) {
            m_consecutiveHighCpu[proc.getPid()]++;
            int count = m_consecutiveHighCpu[proc.getPid()];

            if (count >= m_sustainedSamplesThreshold) {
                // Sustained anomaly triggered
                isCritical = true;
                AnomalyEvent ev;
                ev.pid = proc.getPid();
                ev.processName = proc.getName();
                ev.eventType = "CRITICAL_CPU";
                ev.severity = "CRITICAL";
                ev.cpuUsage = proc.getCpuUsage();
                ev.memoryUsage = proc.getMemoryUsage();
                std::ostringstream oss;
                oss << "CPU usage remained above " << static_cast<int>(m_cpuCriticalThreshold)
                    << "% for " << count << " consecutive samples.";
                ev.message = oss.str();
                ev.timestamp = timestamp;
                events.push_back(ev);
            } else {
                // High CPU warning
                isWarning = true;
                AnomalyEvent ev;
                ev.pid = proc.getPid();
                ev.processName = proc.getName();
                ev.eventType = "HIGH_CPU";
                ev.severity = "WARNING";
                ev.cpuUsage = proc.getCpuUsage();
                ev.memoryUsage = proc.getMemoryUsage();
                std::ostringstream oss;
                oss << "CPU usage spike detected at " << std::fixed << std::setprecision(1)
                    << proc.getCpuUsage() << "% (" << count << "/" << m_sustainedSamplesThreshold
                    << " critical samples).";
                ev.message = oss.str();
                ev.timestamp = timestamp;
                events.push_back(ev);
            }
        } else if (proc.getCpuUsage() >= m_cpuWarningThreshold) {
            // Drop consecutive count if dropped below critical
            m_consecutiveHighCpu[proc.getPid()] = 0;
            isWarning = true;
            AnomalyEvent ev;
            ev.pid = proc.getPid();
            ev.processName = proc.getName();
            ev.eventType = "HIGH_CPU";
            ev.severity = "WARNING";
            ev.cpuUsage = proc.getCpuUsage();
            ev.memoryUsage = proc.getMemoryUsage();
            std::ostringstream oss;
            oss << "CPU usage is elevated at " << std::fixed << std::setprecision(1)
                << proc.getCpuUsage() << "%.";
            ev.message = oss.str();
            ev.timestamp = timestamp;
            events.push_back(ev);
        } else {
            m_consecutiveHighCpu[proc.getPid()] = 0;
        }

        // --- Memory Evaluation ---
        if (proc.getMemoryUsage() >= m_memCriticalThreshold) {
            isCritical = true;
            AnomalyEvent ev;
            ev.pid = proc.getPid();
            ev.processName = proc.getName();
            ev.eventType = "CRITICAL_MEMORY";
            ev.severity = "CRITICAL";
            ev.cpuUsage = proc.getCpuUsage();
            ev.memoryUsage = proc.getMemoryUsage();
            std::ostringstream oss;
            oss << "Memory usage reached critical level at " << std::fixed << std::setprecision(1)
                << proc.getMemoryUsage() << "%.";
            ev.message = oss.str();
            ev.timestamp = timestamp;
            events.push_back(ev);
        } else if (proc.getMemoryUsage() >= m_memWarningThreshold) {
            isWarning = true;
            AnomalyEvent ev;
            ev.pid = proc.getPid();
            ev.processName = proc.getName();
            ev.eventType = "HIGH_MEMORY";
            ev.severity = "WARNING";
            ev.cpuUsage = proc.getCpuUsage();
            ev.memoryUsage = proc.getMemoryUsage();
            std::ostringstream oss;
            oss << "Memory usage is elevated at " << std::fixed << std::setprecision(1)
                << proc.getMemoryUsage() << "%.";
            ev.message = oss.str();
            ev.timestamp = timestamp;
            events.push_back(ev);
        }

        // Update risk level on process
        if (isCritical) {
            proc.setRiskLevel("CRITICAL");
        } else if (isWarning) {
            proc.setRiskLevel("WARNING");
        } else {
            proc.setRiskLevel("NORMAL");
        }
    }

    // Garbage-collect terminated processes from consecutive tracker
    for (auto it = m_consecutiveHighCpu.begin(); it != m_consecutiveHighCpu.end(); ) {
        if (currentPids.find(it->first) == currentPids.end()) {
            it = m_consecutiveHighCpu.erase(it);
        } else {
            ++it;
        }
    }

    return events;
}

void ProcessAnalyzer::reset() {
    m_consecutiveHighCpu.clear();
}

} // namespace processguard
