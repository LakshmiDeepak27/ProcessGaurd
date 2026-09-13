#include "AlertManager.hpp"
#include <sstream>

namespace processguard {

AlertManager::AlertManager(int deduplicationCooldownSec)
    : m_cooldownSeconds(deduplicationCooldownSec) {}

std::string AlertManager::makeAlertKey(int pid, const std::string& eventType) const {
    return std::to_string(pid) + ":" + eventType;
}

std::vector<AlertRecord> AlertManager::processAnomalies(const std::vector<AnomalyEvent>& events) {
    std::vector<AlertRecord> newAlerts;
    auto nowEpoch = std::chrono::duration_cast<std::chrono::seconds>(
                        std::chrono::system_clock::now().time_since_epoch())
                        .count();

    for (const auto& ev : events) {
        std::string key = makeAlertKey(ev.pid, ev.eventType);

        auto it = m_lastTriggeredEpoch.find(key);
        if (it != m_lastTriggeredEpoch.end()) {
            if ((nowEpoch - it->second) < m_cooldownSeconds) {
                // Within cooldown window, skip duplicate notification
                continue;
            }
        }

        m_lastTriggeredEpoch[key] = nowEpoch;

        AlertRecord record;
        record.id = m_nextId++;
        record.pid = ev.pid;
        record.processName = ev.processName;
        record.eventType = ev.eventType;
        record.severity = ev.severity;
        record.cpuUsage = ev.cpuUsage;
        record.memoryUsage = ev.memoryUsage;
        record.message = ev.message;
        record.timestamp = ev.timestamp;

        newAlerts.push_back(record);
        m_activeAlerts.push_back(record);

        // Limit active alerts in-memory buffer to 200 items
        if (m_activeAlerts.size() > 200) {
            m_activeAlerts.erase(m_activeAlerts.begin(), m_activeAlerts.begin() + 50);
        }
    }

    return newAlerts;
}

void AlertManager::clear() {
    m_activeAlerts.clear();
    m_lastTriggeredEpoch.clear();
}

} // namespace processguard
