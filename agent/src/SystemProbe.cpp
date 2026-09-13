#include "SystemProbe.hpp"
#include <fstream>
#include <sstream>
#include <iostream>
#include <algorithm>
#include <cctype>

#if defined(_WIN32) || defined(_WIN64)
#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0600
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <tlhelp32.h>
#include <psapi.h>
#else
#include <unistd.h>
#include <dirent.h>
#include <sys/sysinfo.h>
#endif

namespace processguard {

SystemProbe::SystemProbe() {
#if defined(_WIN32) || defined(_WIN64)
    SYSTEM_INFO sysInfo;
    GetSystemInfo(&sysInfo);
    m_pageSizeKb = sysInfo.dwPageSize > 0 ? (sysInfo.dwPageSize / 1024) : 4;
    m_clockTicksPerSec = 100;
#else
    long ticks = sysconf(_SC_CLK_TCK);
    m_clockTicksPerSec = (ticks > 0) ? ticks : 100;

    long pageSize = sysconf(_SC_PAGESIZE);
    m_pageSizeKb = (pageSize > 0) ? (pageSize / 1024) : 4;
#endif
}

bool SystemProbe::isLinuxProcAvailable(const std::string& procStatPath) {
    std::ifstream file(procStatPath);
    return file.good();
}

bool SystemProbe::readCpuTicks(CpuTicks& outTicks, const std::string& procStatPath) {
    if (isLinuxProcAvailable(procStatPath)) {
        std::ifstream file(procStatPath);
        if (!file.is_open()) {
            return false;
        }

        std::string line;
        while (std::getline(file, line)) {
            if (line.rfind("cpu ", 0) == 0) { // first aggregate cpu line
                std::istringstream iss(line);
                std::string cpuLabel;
                iss >> cpuLabel >> outTicks.user >> outTicks.nice >> outTicks.system
                    >> outTicks.idle >> outTicks.iowait >> outTicks.irq
                    >> outTicks.softirq >> outTicks.steal;
                return true;
            }
        }
        return false;
    }

#if defined(_WIN32) || defined(_WIN64)
    typedef BOOL (WINAPI *PGetSystemTimes)(LPFILETIME, LPFILETIME, LPFILETIME);
    HMODULE hKernel = GetModuleHandleA("kernel32.dll");
    if (hKernel) {
        PGetSystemTimes pGetSystemTimes = (PGetSystemTimes)GetProcAddress(hKernel, "GetSystemTimes");
        if (pGetSystemTimes) {
            FILETIME idleTime, kernelTime, userTime;
            if (pGetSystemTimes(&idleTime, &kernelTime, &userTime)) {
                ULARGE_INTEGER i, k, u;
                i.LowPart = idleTime.dwLowDateTime;
                i.HighPart = idleTime.dwHighDateTime;
                k.LowPart = kernelTime.dwLowDateTime;
                k.HighPart = kernelTime.dwHighDateTime;
                u.LowPart = userTime.dwLowDateTime;
                u.HighPart = userTime.dwHighDateTime;

                // In Windows, kernelTime includes idleTime
                outTicks.idle = i.QuadPart / 10000;
                outTicks.system = (k.QuadPart > i.QuadPart ? (k.QuadPart - i.QuadPart) : 0) / 10000;
                outTicks.user = u.QuadPart / 10000;
                outTicks.nice = 0;
                outTicks.iowait = 0;
                outTicks.irq = 0;
                outTicks.softirq = 0;
                outTicks.steal = 0;
                return true;
            }
        }
    }
#endif
    return false;
}

bool SystemProbe::readMemMetrics(MemMetrics& outMem, const std::string& procMemPath) {
    if (isLinuxProcAvailable(procMemPath)) {
        std::ifstream file(procMemPath);
        if (!file.is_open()) {
            return false;
        }

        std::string line;
        while (std::getline(file, line)) {
            std::istringstream iss(line);
            std::string key;
            uint64_t val;
            std::string unit;
            iss >> key >> val >> unit;

            if (key == "MemTotal:") outMem.totalKb = val;
            else if (key == "MemFree:") outMem.freeKb = val;
            else if (key == "MemAvailable:") outMem.availableKb = val;
            else if (key == "Buffers:") outMem.buffersKb = val;
            else if (key == "Cached:") outMem.cachedKb = val;
        }

        if (outMem.availableKb == 0 && outMem.totalKb > 0) {
            outMem.availableKb = outMem.freeKb + outMem.buffersKb + outMem.cachedKb;
        }
        return outMem.totalKb > 0;
    }

#if defined(_WIN32) || defined(_WIN64)
    MEMORYSTATUSEX memInfo;
    memInfo.dwLength = sizeof(MEMORYSTATUSEX);
    if (GlobalMemoryStatusEx(&memInfo)) {
        outMem.totalKb = memInfo.ullTotalPhys / 1024;
        outMem.freeKb = memInfo.ullAvailPhys / 1024;
        outMem.availableKb = memInfo.ullAvailPhys / 1024;
        outMem.buffersKb = 0;
        outMem.cachedKb = 0;
        return true;
    }
#endif
    return false;
}

uint64_t SystemProbe::readUptime(const std::string& procUptimePath) {
    if (isLinuxProcAvailable(procUptimePath)) {
        std::ifstream file(procUptimePath);
        if (file.is_open()) {
            double upSec = 0.0;
            file >> upSec;
            return static_cast<uint64_t>(upSec);
        }
    }

#if defined(_WIN32) || defined(_WIN64)
    typedef ULONGLONG (WINAPI *PGetTickCount64)(void);
    HMODULE hKernel = GetModuleHandleA("kernel32.dll");
    if (hKernel) {
        PGetTickCount64 pGetTickCount64 = (PGetTickCount64)GetProcAddress(hKernel, "GetTickCount64");
        if (pGetTickCount64) {
            return static_cast<uint64_t>(pGetTickCount64() / 1000);
        }
    }
    return static_cast<uint64_t>(GetTickCount() / 1000);
#else
    return 0;
#endif
}

std::vector<ProcessProcData> SystemProbe::readAllProcesses(const std::string& procDir) {
    std::vector<ProcessProcData> results;

#if !defined(_WIN32) && !defined(_WIN64)
    DIR* dir = opendir(procDir.c_str());
    if (dir) {
        struct dirent* entry = nullptr;
        while ((entry = readdir(dir)) != nullptr) {
            if (entry->d_type != DT_DIR && entry->d_type != DT_UNKNOWN) continue;
            std::string name(entry->d_name);
            if (name.empty() || !std::all_of(name.begin(), name.end(), ::isdigit)) {
                continue;
            }

            int pid = std::stoi(name);
            std::string statPath = procDir + "/" + name + "/stat";
            std::ifstream statFile(statPath);
            if (!statFile.is_open()) continue;

            std::string line;
            if (!std::getline(statFile, line)) continue;

            auto openParen = line.find('(');
            auto closeParen = line.rfind(')');
            if (openParen == std::string::npos || closeParen == std::string::npos || closeParen <= openParen) {
                continue;
            }

            ProcessProcData proc;
            proc.pid = pid;
            proc.comm = line.substr(openParen + 1, closeParen - openParen - 1);

            std::string rest = line.substr(closeParen + 2);
            std::istringstream iss(rest);

            iss >> proc.state >> proc.ppid;

            uint64_t dummy;
            for (int i = 5; i <= 13; ++i) {
                iss >> dummy;
            }
            iss >> proc.utime >> proc.stime;

            for (int i = 16; i <= 21; ++i) {
                iss >> dummy;
            }
            iss >> proc.starttime;

            iss >> dummy >> proc.rssPages;

            results.push_back(proc);
        }
        closedir(dir);
        return results;
    }
#endif

#if defined(_WIN32) || defined(_WIN64)
    HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snapshot != INVALID_HANDLE_VALUE) {
        PROCESSENTRY32W pe;
        pe.dwSize = sizeof(PROCESSENTRY32W);

        if (Process32FirstW(snapshot, &pe)) {
            do {
                ProcessProcData proc;
                proc.pid = static_cast<int>(pe.th32ProcessID);
                proc.ppid = static_cast<int>(pe.th32ParentProcessID);

                char nameBuf[MAX_PATH];
                WideCharToMultiByte(CP_UTF8, 0, pe.szExeFile, -1, nameBuf, sizeof(nameBuf), NULL, NULL);
                proc.comm = std::string(nameBuf);
                proc.state = 'R';

                HANDLE hProc = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_VM_READ, FALSE, pe.th32ProcessID);
                if (hProc) {
                    FILETIME ftCreate, ftExit, ftKernel, ftUser;
                    if (GetProcessTimes(hProc, &ftCreate, &ftExit, &ftKernel, &ftUser)) {
                        ULARGE_INTEGER k, u;
                        k.LowPart = ftKernel.dwLowDateTime;
                        k.HighPart = ftKernel.dwHighDateTime;
                        u.LowPart = ftUser.dwLowDateTime;
                        u.HighPart = ftUser.dwHighDateTime;

                        proc.utime = u.QuadPart / 100000;
                        proc.stime = k.QuadPart / 100000;
                    }

                    PROCESS_MEMORY_COUNTERS pmc;
                    if (GetProcessMemoryInfo(hProc, &pmc, sizeof(pmc))) {
                        proc.rssPages = pmc.WorkingSetSize / (m_pageSizeKb * 1024);
                    }
                    CloseHandle(hProc);
                }

                results.push_back(proc);
            } while (Process32NextW(snapshot, &pe));
        }
        CloseHandle(snapshot);
    }
#endif
    return results;
}

} // namespace processguard
