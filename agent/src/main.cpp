#include "SystemMonitor.hpp"
#include "ProcessAnalyzer.hpp"
#include "AlertManager.hpp"
#include <iostream>
#include <sstream>
#include <iomanip>
#include <string>
#include <cstring>

#if defined(_WIN32) || defined(_WIN64)
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
static void portableSleep(int ms) {
    Sleep(ms);
}
#else
#include <unistd.h>
static void portableSleep(int ms) {
    usleep(ms * 1000);
}
#endif

using namespace processguard;

// Safe JSON string escaper
static std::string escapeJson(const std::string& s) {
    std::ostringstream o;
    for (char c : s) {
        switch (c) {
            case '"': o << "\\\""; break;
            case '\\': o << "\\\\"; break;
            case '\b': o << "\\b"; break;
            case '\f': o << "\\f"; break;
            case '\n': o << "\\n"; break;
            case '\r': o << "\\r"; break;
            case '\t': o << "\\t"; break;
            default:
                if ('\x00' <= c && c <= '\x1f') {
                    o << "\\u"
                      << std::hex << std::setw(4) << std::setfill('0') << static_cast<int>(c);
                } else {
                    o << c;
                }
        }
    }
    return o.str();
}

static std::string serializeToJson(const SystemSnapshot& sys,
                                   const std::vector<Process>& processes,
                                   const std::vector<AlertRecord>& alerts,
                                   size_t limit = 100) {
    std::ostringstream ss;
    ss << std::fixed << std::setprecision(2);
    ss << "{\n";

    // System object
    ss << "  \"system\": {\n";
    ss << "    \"cpuUsage\": " << sys.cpuUsage << ",\n";
    ss << "    \"memoryUsage\": " << sys.memoryUsage << ",\n";
    ss << "    \"totalMemoryMb\": " << sys.totalMemoryMb << ",\n";
    ss << "    \"usedMemoryMb\": " << sys.usedMemoryMb << ",\n";
    ss << "    \"availableMemoryMb\": " << sys.availableMemoryMb << ",\n";
    ss << "    \"uptime\": " << sys.uptime << ",\n";
    ss << "    \"processCount\": " << sys.processCount << ",\n";
    ss << "    \"timestamp\": \"" << escapeJson(sys.timestamp) << "\"\n";
    ss << "  },\n";

    // Processes array
    ss << "  \"processes\": [";
    size_t count = 0;
    for (size_t i = 0; i < processes.size() && count < limit; ++i) {
        const auto& p = processes[i];
        if (count > 0) ss << ",";
        ss << "\n    {";
        ss << "\"pid\": " << p.getPid() << ", ";
        ss << "\"ppid\": " << p.getPpid() << ", ";
        ss << "\"name\": \"" << escapeJson(p.getName()) << "\", ";
        ss << "\"cpu\": " << p.getCpuUsage() << ", ";
        ss << "\"memory\": " << p.getMemoryUsage() << ", ";
        ss << "\"rssKb\": " << p.getMemoryRssKb() << ", ";
        ss << "\"state\": \"" << escapeJson(p.getState()) << "\", ";
        ss << "\"uptimeSec\": " << p.getUptimeSeconds() << ", ";
        ss << "\"risk\": \"" << escapeJson(p.getRiskLevel()) << "\"";
        ss << "}";
        count++;
    }
    if (count > 0) ss << "\n  ";
    ss << "],\n";

    // Alerts array
    ss << "  \"alerts\": [";
    for (size_t i = 0; i < alerts.size(); ++i) {
        const auto& a = alerts[i];
        if (i > 0) ss << ",";
        ss << "\n    {";
        ss << "\"id\": " << a.id << ", ";
        ss << "\"pid\": " << a.pid << ", ";
        ss << "\"name\": \"" << escapeJson(a.processName) << "\", ";
        ss << "\"eventType\": \"" << escapeJson(a.eventType) << "\", ";
        ss << "\"severity\": \"" << escapeJson(a.severity) << "\", ";
        ss << "\"cpu\": " << a.cpuUsage << ", ";
        ss << "\"memory\": " << a.memoryUsage << ", ";
        ss << "\"message\": \"" << escapeJson(a.message) << "\", ";
        ss << "\"timestamp\": \"" << escapeJson(a.timestamp) << "\"";
        ss << "}";
    }
    if (!alerts.empty()) ss << "\n  ";
    ss << "]\n";

    ss << "}\n";
    return ss.str();
}

int main(int argc, char* argv[]) {
    int intervalMs = 350;
    size_t processLimit = 150;
    bool sortCpu = true;

    for (int i = 1; i < argc; ++i) {
        if (std::strcmp(argv[i], "--interval") == 0 && i + 1 < argc) {
            intervalMs = std::stoi(argv[++i]);
        } else if (std::strcmp(argv[i], "--limit") == 0 && i + 1 < argc) {
            processLimit = static_cast<size_t>(std::stoi(argv[++i]));
        } else if (std::strcmp(argv[i], "--help") == 0) {
            std::cout << "ProcessGuard Monitoring Engine v1.0.0\n"
                      << "Usage: processguard_engine [options]\n"
                      << "  --interval <ms>   Sampling interval in milliseconds (default: 350)\n"
                      << "  --limit <N>       Limit number of processes in output (default: 150)\n"
                      << "  --help            Show this help message\n";
            return 0;
        }
    }

    SystemMonitor monitor;
    ProcessAnalyzer analyzer;
    AlertManager alertManager;

    // Initial baseline sample
    monitor.collect();

    // Sleep for the specified delta interval to measure realistic CPU rate of change
    if (intervalMs > 0) {
        portableSleep(intervalMs);
        monitor.collect();
    }

    SystemSnapshot sysSnap = monitor.getSystemSnapshot();
    ProcessSnapshot procSnap = monitor.getProcessSnapshot();

    // Analyze processes for anomalies (updates risk levels in-place)
    auto anomalies = analyzer.analyze(procSnap.processes, sysSnap.timestamp);
    auto newAlerts = alertManager.processAnomalies(anomalies);

    // Sort processes by CPU descending (DSA: std::sort)
    if (sortCpu) {
        monitor.getProcessMonitorMut().sortByCpu(true);
        // Refresh processes vector from sorted monitor
        procSnap.processes = monitor.getProcessMonitor().getProcesses();
        // Re-apply risk levels after sort
        analyzer.analyze(procSnap.processes, sysSnap.timestamp);
    }

    // Output valid JSON
    std::string jsonStr = serializeToJson(sysSnap, procSnap.processes, alertManager.getActiveAlerts(), processLimit);
    std::cout << jsonStr << std::flush;

    return 0;
}
