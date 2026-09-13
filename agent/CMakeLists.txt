cmake_minimum_required(VERSION 3.15)
project(ProcessGuard VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Include directories
include_directories(${CMAKE_CURRENT_SOURCE_DIR}/include)

set(ENGINE_HEADERS
    include/AlertManager.hpp
    include/CpuMonitor.hpp
    include/MemoryMonitor.hpp
    include/Monitor.hpp
    include/Process.hpp
    include/ProcessAnalyzer.hpp
    include/ProcessMonitor.hpp
    include/Snapshots.hpp
    include/SystemMonitor.hpp
    include/SystemProbe.hpp
)

set(ENGINE_SOURCES
    src/SystemProbe.cpp
    src/CpuMonitor.cpp
    src/MemoryMonitor.cpp
    src/ProcessMonitor.cpp
    src/SystemMonitor.cpp
    src/ProcessAnalyzer.cpp
    src/AlertManager.cpp
)

# Core library for engine components (used by executables and tests)
add_library(processguard_core STATIC ${ENGINE_SOURCES} ${ENGINE_HEADERS})
target_include_directories(processguard_core PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)

if(WIN32)
    target_link_libraries(processguard_core PUBLIC psapi)
else()
    target_link_libraries(processguard_core PUBLIC pthread)
endif()

# ProcessGuard executable
add_executable(ProcessGuard src/main.cpp)
target_link_libraries(ProcessGuard PRIVATE processguard_core)

# Also provide processguard_engine executable for backward compatibility and backend bridge
add_executable(processguard_engine src/main.cpp)
target_link_libraries(processguard_engine PRIVATE processguard_core)

# Tests
enable_testing()
add_subdirectory(tests)
