#pragma once

#include "ProcessAnalyzer.hpp"
#include <string>
#include <vector>
#include <unordered_map>
#include <chrono>

namespace processguard {

struct AlertRecord {
    int id{0};
    int pid{0};
    std::string processName;
    std::string eventType;
    std::string severity; // INFO, WARNING, CRITICAL
    double cpuUsage{0.0};
    double memoryUsage{0.0};
    std::string message;
    std::string timestamp;
};

/**
 * @brief AlertManager receives anomalies, applies deduplication, tracks active states, and formats alerts.
 */
class AlertManager {
public:
    explicit AlertManager(int deduplicationCooldownSec = 30);
    ~AlertManager() = default;

    /**
     * @brief Process incoming anomaly events, filter duplicates within cooldown period, and record alerts.
     * @return New alerts added in this evaluation cycle.
     */
    std::vector<AlertRecord> processAnomalies(const std::vector<AnomalyEvent>& events);

    const std::vector<AlertRecord>& getActiveAlerts() const { return m_activeAlerts; }
    void clear();

private:
    std::string makeAlertKey(int pid, const std::string& eventType) const;

    int m_cooldownSeconds{30};
    int m_nextId{1};
    std::vector<AlertRecord> m_activeAlerts;

    // Alert key (pid:eventType) -> last triggered timestamp in epoch seconds
    std::unordered_map<std::string, int64_t> m_lastTriggeredEpoch;
};

} // namespace processguard
