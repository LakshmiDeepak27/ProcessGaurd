add_executable(engine_tests test_main.cpp)
target_link_libraries(engine_tests PRIVATE processguard_core)

add_test(NAME EngineUnitTests COMMAND engine_tests)
