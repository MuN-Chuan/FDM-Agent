#include <windows.h>

#include <chrono>
#include <cctype>
#include <condition_variable>
#include <filesystem>
#include <functional>
#include <iostream>
#include <map>
#include <mutex>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

namespace {

using OnLocalConnectedFn = std::function<void(int, std::string, std::string)>;
using OnMessageFn = std::function<void(std::string, std::string)>;

using func_create_agent = void* (*)(std::string log_dir);
using func_destroy_agent = int (*)(void* agent);
using func_init_log = int (*)(void* agent);
using func_set_config_dir = int (*)(void* agent, std::string config_dir);
using func_set_cert_file = int (*)(void* agent, std::string folder, std::string filename);
using func_set_country_code = int (*)(void* agent, std::string country_code);
using func_start = int (*)(void* agent);
using func_connect_server = int (*)(void* agent);
using func_is_user_login = bool (*)(void* agent);
using func_start_subscribe = int (*)(void* agent, std::string module);
using func_add_subscribe = int (*)(void* agent, std::vector<std::string> dev_list);
using func_send_message = int (*)(void* agent, std::string dev_id, std::string json_str, int qos, int flag);
using func_set_on_local_connect_fn = int (*)(void* agent, OnLocalConnectedFn fn);
using func_set_on_local_message_fn = int (*)(void* agent, OnMessageFn fn);
using func_set_on_message_fn = int (*)(void* agent, OnMessageFn fn);
using func_connect_printer = int (*)(void* agent, std::string dev_id, std::string dev_ip, std::string username, std::string password, bool use_ssl);
using func_disconnect_printer = int (*)(void* agent);
using func_send_message_to_printer = int (*)(void* agent, std::string dev_id, std::string json_str, int qos, int flag);
using func_check_cert = int (*)(void* agent);
using func_install_device_cert = void (*)(void* agent, std::string dev_id, bool lan_only);

struct CallbackState {
    std::mutex mutex;
    std::condition_variable cv;
    bool connected = false;
    int connect_status = -9999;
    std::string connect_dev_id;
    std::string connect_message;
    bool message_received = false;
    std::vector<std::string> messages;
};

struct BridgeFunctions {
    func_create_agent create_agent = nullptr;
    func_destroy_agent destroy_agent = nullptr;
    func_init_log init_log = nullptr;
    func_set_config_dir set_config_dir = nullptr;
    func_set_cert_file set_cert_file = nullptr;
    func_set_country_code set_country_code = nullptr;
    func_start start = nullptr;
    func_connect_server connect_server = nullptr;
    func_is_user_login is_user_login = nullptr;
    func_start_subscribe start_subscribe = nullptr;
    func_add_subscribe add_subscribe = nullptr;
    func_send_message send_message = nullptr;
    func_set_on_local_connect_fn set_on_local_connect_fn = nullptr;
    func_set_on_local_message_fn set_on_local_message_fn = nullptr;
    func_set_on_message_fn set_on_message_fn = nullptr;
    func_connect_printer connect_printer = nullptr;
    func_disconnect_printer disconnect_printer = nullptr;
    func_send_message_to_printer send_message_to_printer = nullptr;
    func_check_cert check_cert = nullptr;
    func_install_device_cert install_device_cert = nullptr;
};

std::string json_escape(const std::string& value)
{
    std::ostringstream escaped;
    for (const char ch : value) {
        switch (ch) {
        case '\\': escaped << "\\\\"; break;
        case '"': escaped << "\\\""; break;
        case '\n': escaped << "\\n"; break;
        case '\r': escaped << "\\r"; break;
        case '\t': escaped << "\\t"; break;
        default:
            if (static_cast<unsigned char>(ch) < 0x20) {
                escaped << "\\u"
                        << std::hex << std::uppercase
                        << static_cast<int>(static_cast<unsigned char>(ch));
            } else {
                escaped << ch;
            }
        }
    }
    return escaped.str();
}

void print_json_error(const std::string& message)
{
    std::cout << "{\"ok\":false,\"error\":\"" << json_escape(message) << "\"}" << std::endl;
}

std::optional<std::string> get_argument(const std::map<std::string, std::string>& args, const std::string& key)
{
    const auto it = args.find(key);
    if (it == args.end() || it->second.empty()) {
        return std::nullopt;
    }
    return it->second;
}

std::optional<std::string> extract_sequence_id(const std::string& payload)
{
    const std::string needle = "\"sequence_id\"";
    const auto key_pos = payload.find(needle);
    if (key_pos == std::string::npos) {
        return std::nullopt;
    }

    const auto colon_pos = payload.find(':', key_pos + needle.size());
    if (colon_pos == std::string::npos) {
        return std::nullopt;
    }

    auto value_pos = payload.find_first_not_of(" \t\r\n", colon_pos + 1);
    if (value_pos == std::string::npos) {
        return std::nullopt;
    }

    if (payload[value_pos] == '"') {
        const auto end_quote = payload.find('"', value_pos + 1);
        if (end_quote == std::string::npos) {
            return std::nullopt;
        }
        return payload.substr(value_pos + 1, end_quote - value_pos - 1);
    }

    auto end_pos = value_pos;
    while (end_pos < payload.size() && std::isdigit(static_cast<unsigned char>(payload[end_pos]))) {
        end_pos += 1;
    }
    if (end_pos == value_pos) {
        return std::nullopt;
    }
    return payload.substr(value_pos, end_pos - value_pos);
}

std::optional<std::string> find_matching_message(const std::vector<std::string>& messages, const std::optional<std::string>& sequence_id)
{
    if (messages.empty()) {
        return std::nullopt;
    }

    if (!sequence_id.has_value()) {
        return messages.back();
    }

    const std::string quoted = "\"" + *sequence_id + "\"";
    for (auto it = messages.rbegin(); it != messages.rend(); ++it) {
        if (it->find("\"sequence_id\"") != std::string::npos &&
            (it->find(quoted) != std::string::npos || it->find(*sequence_id) != std::string::npos)) {
            return *it;
        }
    }

    return messages.back();
}

template <typename T>
T require_function(HMODULE module, const char* name)
{
    auto* raw = GetProcAddress(module, name);
    if (!raw) {
        throw std::runtime_error(std::string("Missing DLL export: ") + name);
    }
    return reinterpret_cast<T>(raw);
}

BridgeFunctions load_functions(HMODULE module)
{
    BridgeFunctions fns;
    fns.create_agent = require_function<func_create_agent>(module, "bambu_network_create_agent");
    fns.destroy_agent = require_function<func_destroy_agent>(module, "bambu_network_destroy_agent");
    fns.init_log = require_function<func_init_log>(module, "bambu_network_init_log");
    fns.set_config_dir = require_function<func_set_config_dir>(module, "bambu_network_set_config_dir");
    fns.set_cert_file = require_function<func_set_cert_file>(module, "bambu_network_set_cert_file");
    fns.set_country_code = require_function<func_set_country_code>(module, "bambu_network_set_country_code");
    fns.start = require_function<func_start>(module, "bambu_network_start");
    fns.connect_server = require_function<func_connect_server>(module, "bambu_network_connect_server");
    fns.is_user_login = require_function<func_is_user_login>(module, "bambu_network_is_user_login");
    fns.start_subscribe = require_function<func_start_subscribe>(module, "bambu_network_start_subscribe");
    fns.add_subscribe = require_function<func_add_subscribe>(module, "bambu_network_add_subscribe");
    fns.send_message = require_function<func_send_message>(module, "bambu_network_send_message");
    fns.set_on_local_connect_fn = require_function<func_set_on_local_connect_fn>(module, "bambu_network_set_on_local_connect_fn");
    fns.set_on_local_message_fn = require_function<func_set_on_local_message_fn>(module, "bambu_network_set_on_local_message_fn");
    fns.set_on_message_fn = require_function<func_set_on_message_fn>(module, "bambu_network_set_on_message_fn");
    fns.connect_printer = require_function<func_connect_printer>(module, "bambu_network_connect_printer");
    fns.disconnect_printer = require_function<func_disconnect_printer>(module, "bambu_network_disconnect_printer");
    fns.send_message_to_printer = require_function<func_send_message_to_printer>(module, "bambu_network_send_message_to_printer");
    fns.check_cert = require_function<func_check_cert>(module, "bambu_network_update_cert");
    fns.install_device_cert = require_function<func_install_device_cert>(module, "bambu_network_install_device_cert");
    return fns;
}

bool wait_for_connection(CallbackState& state, int timeout_ms)
{
    std::unique_lock<std::mutex> lock(state.mutex);
    return state.cv.wait_for(lock, std::chrono::milliseconds(timeout_ms), [&state]() { return state.connected; });
}

bool wait_for_message(CallbackState& state, int timeout_ms)
{
    std::unique_lock<std::mutex> lock(state.mutex);
    return state.cv.wait_for(lock, std::chrono::milliseconds(timeout_ms), [&state]() { return state.message_received; });
}

std::filesystem::path default_log_dir(const std::filesystem::path& config_dir)
{
    return config_dir / "log";
}

} // namespace

int main(int argc, char** argv)
{
    try {
        std::map<std::string, std::string> args;
        for (int i = 1; i < argc; i += 1) {
            std::string key = argv[i];
            if (key.rfind("--", 0) != 0) {
                continue;
            }
            if (i + 1 >= argc) {
                args[key] = "";
                continue;
            }
            args[key] = argv[i + 1];
            i += 1;
        }

        const auto command = get_argument(args, "--command");
        if (!command.has_value() || (*command != "local_send" && *command != "cloud_send")) {
            print_json_error("Unsupported or missing --command");
            return 1;
        }

        const auto plugin_dll = get_argument(args, "--plugin-dll");
        const auto config_dir = get_argument(args, "--config-dir");
        const auto cert_dir = get_argument(args, "--cert-dir");
        const auto printer_id = get_argument(args, "--printer-id");
        const auto printer_ip = get_argument(args, "--printer-ip");
        const auto access_code = get_argument(args, "--access-code");
        const auto payload = get_argument(args, "--payload");
        const auto country_code = get_argument(args, "--country-code");

        if (!plugin_dll || !config_dir || !cert_dir || !printer_id || !payload) {
            print_json_error("Missing required arguments");
            return 1;
        }
        if (*command == "local_send" && (!printer_ip || !access_code)) {
            print_json_error("local_send requires --printer-ip and --access-code");
            return 1;
        }

        if (!std::filesystem::exists(*plugin_dll)) {
            print_json_error("bambu_networking.dll not found");
            return 1;
        }

        SetDllDirectoryW(std::filesystem::path(*plugin_dll).parent_path().c_str());
        const HMODULE module = LoadLibraryW(std::filesystem::path(*plugin_dll).c_str());
        if (!module) {
            print_json_error("Failed to load bambu_networking.dll");
            return 1;
        }

        const auto functions = load_functions(module);
        const auto log_dir = default_log_dir(std::filesystem::path(*config_dir));
        std::filesystem::create_directories(log_dir);

        CallbackState callbacks;
        void* agent = functions.create_agent(log_dir.string());
        if (!agent) {
            FreeLibrary(module);
            print_json_error("bambu_network_create_agent returned null");
            return 1;
        }

        const auto cleanup = [&]() {
            try {
                functions.disconnect_printer(agent);
            } catch (...) {
            }
            try {
                functions.destroy_agent(agent);
            } catch (...) {
            }
            FreeLibrary(module);
        };

        functions.set_on_local_connect_fn(agent, [&callbacks](int status, std::string dev_id, std::string msg) {
            std::lock_guard<std::mutex> lock(callbacks.mutex);
            callbacks.connected = true;
            callbacks.connect_status = status;
            callbacks.connect_dev_id = std::move(dev_id);
            callbacks.connect_message = std::move(msg);
            callbacks.cv.notify_all();
        });

        functions.set_on_local_message_fn(agent, [&callbacks](std::string dev_id, std::string msg) {
            std::lock_guard<std::mutex> lock(callbacks.mutex);
            callbacks.message_received = true;
            callbacks.messages.push_back(std::move(msg));
            callbacks.connect_dev_id = std::move(dev_id);
            callbacks.cv.notify_all();
        });
        functions.set_on_message_fn(agent, [&callbacks](std::string dev_id, std::string msg) {
            std::lock_guard<std::mutex> lock(callbacks.mutex);
            callbacks.message_received = true;
            callbacks.messages.push_back(std::move(msg));
            callbacks.connect_dev_id = std::move(dev_id);
            callbacks.cv.notify_all();
        });

        const int config_ret = functions.set_config_dir(agent, *config_dir);
        const int log_ret = functions.init_log(agent);
        const int cert_ret = functions.set_cert_file(agent, *cert_dir, "slicer_base64.cer");
        const int country_ret = functions.set_country_code(agent, country_code.value_or("CN"));
        const int start_ret = functions.start(agent);
        const int check_cert_ret = functions.check_cert(agent);
        functions.install_device_cert(agent, *printer_id, true);

        int connect_ret = 0;
        int connect_status = -9999;
        std::string connect_dev_id;
        std::string connect_message;
        int server_ret = 0;
        bool user_login = false;
        int subscribe_ret = 0;
        int add_subscribe_ret = 0;
        int send_ret = 0;

        if (*command == "local_send") {
            connect_ret = functions.connect_printer(agent, *printer_id, *printer_ip, "bblp", *access_code, true);
            const bool got_connect = wait_for_connection(callbacks, 6000);
            if (!got_connect && connect_ret != 0) {
                cleanup();
                std::ostringstream output;
                output << "{\"ok\":false,\"stage\":\"connect\",\"config_ret\":" << config_ret
                       << ",\"log_ret\":" << log_ret
                       << ",\"cert_ret\":" << cert_ret
                       << ",\"country_ret\":" << country_ret
                       << ",\"start_ret\":" << start_ret
                       << ",\"check_cert_ret\":" << check_cert_ret
                       << ",\"connect_ret\":" << connect_ret
                       << ",\"error\":\"connect_printer failed\"}";
                std::cout << output.str() << std::endl;
                return 2;
            }

            send_ret = functions.send_message_to_printer(agent, *printer_id, *payload, 0, 0);
        } else {
            user_login = functions.is_user_login(agent);
            server_ret = functions.connect_server(agent);
            std::this_thread::sleep_for(std::chrono::milliseconds(1500));
            subscribe_ret = functions.start_subscribe(agent, "app");
            add_subscribe_ret = functions.add_subscribe(agent, std::vector<std::string>{*printer_id});
            std::this_thread::sleep_for(std::chrono::milliseconds(1500));
            send_ret = functions.send_message(agent, *printer_id, *payload, 0, 0);
        }

        wait_for_message(callbacks, 8000);

        std::vector<std::string> messages;
        {
            std::lock_guard<std::mutex> lock(callbacks.mutex);
            messages = callbacks.messages;
            connect_status = callbacks.connect_status;
            connect_dev_id = callbacks.connect_dev_id;
            connect_message = callbacks.connect_message;
        }

        const auto sequence_id = extract_sequence_id(*payload);
        const auto matched_message = find_matching_message(messages, sequence_id);

        std::ostringstream output;
        output << "{"
               << "\"ok\":" << ((connect_ret == 0 && send_ret == 0) ? "true" : "false")
               << ",\"config_ret\":" << config_ret
               << ",\"log_ret\":" << log_ret
               << ",\"cert_ret\":" << cert_ret
               << ",\"country_ret\":" << country_ret
               << ",\"start_ret\":" << start_ret
               << ",\"check_cert_ret\":" << check_cert_ret
               << ",\"server_ret\":" << server_ret
               << ",\"user_login\":" << (user_login ? "true" : "false")
               << ",\"subscribe_ret\":" << subscribe_ret
               << ",\"add_subscribe_ret\":" << add_subscribe_ret
               << ",\"connect_ret\":" << connect_ret
               << ",\"connect_status\":" << connect_status
               << ",\"send_ret\":" << send_ret
               << ",\"connect_dev_id\":\"" << json_escape(connect_dev_id) << "\""
               << ",\"connect_message\":\"" << json_escape(connect_message) << "\"";

        if (sequence_id.has_value()) {
            output << ",\"sequence_id\":\"" << json_escape(*sequence_id) << "\"";
        }
        if (matched_message.has_value()) {
            output << ",\"response\":\"" << json_escape(*matched_message) << "\"";
        }

        output << ",\"message_count\":" << messages.size() << "}";
        cleanup();
        std::cout << output.str() << std::endl;
        return (send_ret == 0) ? 0 : 3;
    } catch (const std::exception& error) {
        print_json_error(error.what());
        return 1;
    } catch (...) {
        print_json_error("Unknown bridge error");
        return 1;
    }
}
