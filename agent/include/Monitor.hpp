#pragma once

namespace processguard {

/**
 * @brief Abstract base class defining the contract for all hardware and system monitors.
 * Demonstrates Abstraction and Interface Polymorphism.
 */
class Monitor {
public:
    virtual ~Monitor() = default;

    /**
     * @brief Polls and updates system telemetry metrics.
     * @return true if metrics were collected successfully, false otherwise.
     */
    virtual bool collect() = 0;

    /**
     * @brief Resets monitor state or counters.
     */
    virtual void reset() = 0;
};

} // namespace processguard
