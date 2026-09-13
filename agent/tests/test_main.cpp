#include <iostream>
#include <cassert>
#include <cmath>
#include <vector>
#include <memory>
#include <algorithm>
#include "Process.hpp"
#include "CpuMonitor.hpp"
#include "MemoryMonitor.hpp"
#include "ProcessMonitor.hpp"
#include "ProcessAnalyzer.hpp"
#include "AlertManager.hpp"
#include "Snapshots.hpp"

using namespace processguard;

// Test helper macros
#define TEST_ASSERT(cond, msg) \
    do { \
        if (!(cond)) { \
            std::cerr << "[FAILED] " << msg << " (" << __FILE__ << ":" << __LINE__ << ")\n"; \
            return false; \
        } \
    } while(0)

#define RUN_TEST(fn) \
    do { \
        std::cout << "[RUNNING] " << #fn << "...\n"; \
        if (fn()) { \
            std::cout << "[PASSED]  " << #fn << "\n"; \
            passedCount++; \
        } else { \
            std::cerr << "[FAILED]  " << #fn << "\n"; \
            failedCount++; \
        } \
    } while(0)

bool testCpuCalculation() {
    // Zero delta
    double usageZero = CpuMonitor::calculateUsage(100, 100, 100, 100);
    TEST_ASSERT(std::abs(usageZero - 0.0) < 0.001, "Zero delta should return 0.0");

    // 50% CPU: delta total = 200, delta idle = 100
    // prev: idle=100, total=500; curr: idle=200, total=700
    double usage50 = CpuMonitor::calculateUsage(100, 500, 200, 700);
    TEST_ASSERT(std::abs(usage50 - 50.0) < 0.001, "Expected 50% CPU usage");

    // 100% CPU: delta total = 100, delta idle = 0
    // prev: idle=100, total=500; curr: idle=100, total=600
    double usage100 = CpuMonitor::calculateUsage(100, 500, 100, 600);
    TEST_ASSERT(std::abs(usage100 - 100.0) < 0.001, "Expected 100% CPU usage");

    return true;
}

bool testMemoryCalculation() {
    // 16GB total, 8GB available -> 50% used
    double usage50 = MemoryMonitor::calculateUsagePercent(16000000, 8000000);
    TEST_ASSERT(std::abs(usage50 - 50.0) < 0.001, "Expected 50% memory usage");

    // 100% used (0 available)
    double usage100 = MemoryMonitor::calculateUsagePercent(16000000, 0);
    TEST_ASSERT(std::abs(usage100 - 100.0) < 0.001, "Expected 100% memory usage");

    // 0% used (total == available)
    double usage0 = MemoryMonitor::calculateUsagePercent(16000000, 16000000);
    TEST_ASSERT(std::abs(usage0 - 0.0) < 0.001, "Expected 0% memory usage");

    return true;
}

bool testProcessSortingAndSearch() {
    auto probe = std::make_shared<SystemProbe>();
    ProcessMonitor monitor(probe);

    // Create mock process list
    std::vector<Process> procs;
    procs.emplace_back(101, 1, "nginx", 15.5, 4.2, 50000, "running");
    procs.emplace_back(202, 1, "postgres", 85.0, 45.0, 500000, "running");
    procs.emplace_back(303, 1, "redis-server", 5.0, 12.0, 120000, "running");
    procs.emplace_back(404, 1, "python_worker", 95.0, 25.0, 250000, "running");

    // Sort by CPU descending
    std::sort(procs.begin(), procs.end(), [](const Process& a, const Process& b) {
        return a.getCpuUsage() > b.getCpuUsage();
    });

    TEST_ASSERT(procs.front().getPid() == 404, "Top CPU process must be PID 404");
    TEST_ASSERT(procs.front().getName() == "python_worker", "Top CPU process must be python_worker");
    TEST_ASSERT(procs.back().getPid() == 303, "Lowest CPU process must be PID 303");

    // Sort by Memory descending
    std::sort(procs.begin(), procs.end(), [](const Process& a, const Process& b) {
        return a.getMemoryUsage() > b.getMemoryUsage();
    });
    TEST_ASSERT(procs.front().getPid() == 202, "Top Memory process must be PID 202 (postgres)");

    // Search by name (case insensitive)
    std::string search = "WORKER";
    bool found = false;
    for (const auto& p : procs) {
        std::string n = p.getName();
        if (n.find("worker") != std::string::npos) {
            found = true;
            TEST_ASSERT(p.getPid() == 404, "PID for worker should be 404");
        }
    }
    TEST_ASSERT(found, "Should find worker process");

    return true;
}

bool testTopConsumerPriorityQueue() {
    std::vector<Process> procs;
    procs.emplace_back(1, 0, "proc1", 10.0, 10.0, 1000, "running");
    procs.emplace_back(2, 0, "proc2", 90.0, 20.0, 2000, "running");
    procs.emplace_back(3, 0, "proc3", 50.0, 80.0, 8000, "running");
    procs.emplace_back(4, 0, "proc4", 75.0, 30.0, 3000, "running");
    procs.emplace_back(5, 0, "proc5", 25.0, 95.0, 9500, "running");

    // Priority queue to find top 2 CPU
    auto cmp = [](const Process& a, const Process& b) {
        return a.getCpuUsage() > b.getCpuUsage(); // min-heap
    };
    std::priority_queue<Process, std::vector<Process>, decltype(cmp)> minHeap(cmp);

    size_t k = 2;
    for (const auto& p : procs) {
        if (minHeap.size() < k) {
            minHeap.push(p);
        } else if (p.getCpuUsage() > minHeap.top().getCpuUsage()) {
            minHeap.pop();
            minHeap.push(p);
        }
    }

    std::vector<Process> top2;
    while (!minHeap.empty()) {
        top2.push_back(minHeap.top());
        minHeap.pop();
    }
    std::reverse(top2.begin(), top2.end());

    TEST_ASSERT(top2.size() == 2, "Top 2 size must be 2");
    TEST_ASSERT(top2[0].getPid() == 2, "Highest CPU must be PID 2 (90%)");
    TEST_ASSERT(top2[1].getPid() == 4, "Second highest CPU must be PID 4 (75%)");

    return true;
}

bool testAnomalyDetectionRules() {
    ProcessAnalyzer analyzer(80.0, 90.0, 80.0, 90.0, 3);
    std::string ts = "2026-09-13T12:00:00Z";

    std::vector<Process> procs;
    // Normal process
    procs.emplace_back(100, 1, "safe_proc", 20.0, 30.0, 5000, "running");
    // High CPU warning (>80%)
    procs.emplace_back(200, 1, "warm_proc", 85.0, 10.0, 2000, "running");
    // High Memory warning (>80%)
    procs.emplace_back(300, 1, "mem_proc", 10.0, 88.0, 80000, "running");
    // Critical Memory (>90%)
    procs.emplace_back(400, 1, "hog_proc", 10.0, 95.0, 95000, "running");

    auto events = analyzer.analyze(procs, ts);

    TEST_ASSERT(procs[0].getRiskLevel() == "NORMAL", "PID 100 risk must be NORMAL");
    TEST_ASSERT(procs[1].getRiskLevel() == "WARNING", "PID 200 risk must be WARNING");
    TEST_ASSERT(procs[2].getRiskLevel() == "WARNING", "PID 300 risk must be WARNING");
    TEST_ASSERT(procs[3].getRiskLevel() == "CRITICAL", "PID 400 risk must be CRITICAL");

    TEST_ASSERT(events.size() == 3, "Expected 3 anomaly events");

    return true;
}

bool testSustainedCpuAnomalyDetection() {
    // Rule: remains above 90% CPU for 3 consecutive monitoring samples -> CRITICAL_CPU
    ProcessAnalyzer analyzer(80.0, 90.0, 80.0, 90.0, 3);
    std::string ts = "2026-09-13T12:00:00Z";

    std::vector<Process> sample1 = {
        Process(4821, 1, "example", 94.7, 10.0, 2000, "running")
    };
    auto ev1 = analyzer.analyze(sample1, ts);
    TEST_ASSERT(sample1[0].getRiskLevel() == "WARNING", "Sample 1 should be WARNING");
    TEST_ASSERT(ev1[0].severity == "WARNING", "Sample 1 event severity should be WARNING");

    std::vector<Process> sample2 = {
        Process(4821, 1, "example", 92.1, 10.0, 2000, "running")
    };
    auto ev2 = analyzer.analyze(sample2, ts);
    TEST_ASSERT(sample2[0].getRiskLevel() == "WARNING", "Sample 2 should be WARNING");

    std::vector<Process> sample3 = {
        Process(4821, 1, "example", 95.3, 10.0, 2000, "running")
    };
    auto ev3 = analyzer.analyze(sample3, ts);
    TEST_ASSERT(sample3[0].getRiskLevel() == "CRITICAL", "Sample 3 must trigger CRITICAL");
    TEST_ASSERT(!ev3.empty(), "Sample 3 must have events");
    TEST_ASSERT(ev3[0].eventType == "CRITICAL_CPU", "Event type must be CRITICAL_CPU");
    TEST_ASSERT(ev3[0].severity == "CRITICAL", "Severity must be CRITICAL");
    TEST_ASSERT(ev3[0].message.find("3 consecutive samples") != std::string::npos,
                "Message must cite 3 consecutive samples");

    return true;
}

bool testAlertManagerDeduplication() {
    AlertManager manager(10); // 10 second cooldown
    std::string ts = "2026-09-13T12:00:00Z";

    std::vector<AnomalyEvent> anomalies = {
        {101, "bad_app", "HIGH_CPU", "WARNING", 85.0, 10.0, "High CPU", ts}
    };

    // First call: alert generated
    auto alerts1 = manager.processAnomalies(anomalies);
    TEST_ASSERT(alerts1.size() == 1, "First evaluation should yield 1 alert");
    TEST_ASSERT(manager.getActiveAlerts().size() == 1, "Active alerts size should be 1");

    // Second immediate call with identical event: should be deduplicated
    auto alerts2 = manager.processAnomalies(anomalies);
    TEST_ASSERT(alerts2.empty(), "Immediate identical anomaly must be deduplicated");
    TEST_ASSERT(manager.getActiveAlerts().size() == 1, "Active alerts must remain 1");

    return true;
}

int main() {
    std::cout << "========================================\n";
    std::cout << "  ProcessGuard C++ Engine Unit Tests\n";
    std::cout << "========================================\n";

    int passedCount = 0;
    int failedCount = 0;

    RUN_TEST(testCpuCalculation);
    RUN_TEST(testMemoryCalculation);
    RUN_TEST(testProcessSortingAndSearch);
    RUN_TEST(testTopConsumerPriorityQueue);
    RUN_TEST(testAnomalyDetectionRules);
    RUN_TEST(testSustainedCpuAnomalyDetection);
    RUN_TEST(testAlertManagerDeduplication);

    std::cout << "----------------------------------------\n";
    std::cout << "Total Tests: " << (passedCount + failedCount)
              << " | Passed: " << passedCount
              << " | Failed: " << failedCount << "\n";
    std::cout << "========================================\n";

    return (failedCount == 0) ? 0 : 1;
}
