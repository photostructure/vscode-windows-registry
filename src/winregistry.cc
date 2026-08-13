/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for
 *  license information.
 *--------------------------------------------------------------------------------------------*/

#include <windows.h>

#include <array>
#include <cstddef>
#include <exception>
#include <memory>
#include <new>
#include <stdexcept>
#include <string>
#include <type_traits>

#include <node_api.h>

namespace {

constexpr size_t kArgumentCount = 3;
constexpr size_t kMaximumArgumentBytes = 16383;

bool CheckNapiStatus(napi_env env, napi_status status) noexcept {
  if (status == napi_ok) {
    return true;
  }

  bool exceptionPending = false;
  if (napi_is_exception_pending(env, &exceptionPending) == napi_ok &&
      exceptionPending) {
    return false;
  }

  napi_throw_error(env, nullptr, "NAPI call failed");
  return false;
}

#define NAPI_CALL(env, call)                                                   \
  do {                                                                         \
    if (!CheckNapiStatus((env), (call))) {                                     \
      return nullptr;                                                          \
    }                                                                          \
  } while (false)

template <typename Callback>
napi_value InvokeSafely(napi_env env, Callback callback) noexcept {
  try {
    return callback();
  } catch (const std::bad_alloc &) {
    napi_throw_error(env, nullptr, "Native allocation failed");
  } catch (const std::exception &error) {
    napi_throw_error(env, nullptr, error.what());
  } catch (...) {
    napi_throw_error(env, nullptr, "Unexpected native exception");
  }
  return nullptr;
}

std::wstring Utf8ToWide(const std::string &utf8) {
  if (utf8.empty()) {
    return {};
  }

  const int inputLength = static_cast<int>(utf8.size());
  const int outputLength = MultiByteToWideChar(
      CP_UTF8, MB_ERR_INVALID_CHARS, utf8.data(), inputLength, nullptr, 0);
  if (outputLength <= 0) {
    throw std::runtime_error("Registry argument is not valid UTF-8");
  }

  std::wstring wide(static_cast<size_t>(outputLength), L'\0');
  const int converted =
      MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, utf8.data(),
                          inputLength, wide.data(), outputLength);
  if (converted != outputLength) {
    throw std::runtime_error("Failed to convert registry argument to UTF-16");
  }
  return wide;
}

std::string WideToUtf8(const wchar_t *wide, size_t wcharCount) {
  if (wcharCount == 0) {
    return {};
  }

  const int inputLength = static_cast<int>(wcharCount);
  const int outputLength =
      WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, wide, inputLength,
                          nullptr, 0, nullptr, nullptr);
  if (outputLength <= 0) {
    throw std::runtime_error("Registry value is not valid UTF-16");
  }

  std::string utf8(static_cast<size_t>(outputLength), '\0');
  const int converted = WideCharToMultiByte(
      CP_UTF8, WC_ERR_INVALID_CHARS, wide, inputLength, utf8.data(),
      outputLength, nullptr, nullptr);
  if (converted != outputLength) {
    throw std::runtime_error("Failed to convert registry value to UTF-8");
  }
  return utf8;
}

HKEY GetHive(const std::string &hkey) noexcept {
  if (hkey == "HKEY_CURRENT_USER") {
    return HKEY_CURRENT_USER;
  }
  if (hkey == "HKEY_LOCAL_MACHINE") {
    return HKEY_LOCAL_MACHINE;
  }
  if (hkey == "HKEY_CLASSES_ROOT") {
    return HKEY_CLASSES_ROOT;
  }
  if (hkey == "HKEY_USERS") {
    return HKEY_USERS;
  }
  if (hkey == "HKEY_CURRENT_CONFIG") {
    return HKEY_CURRENT_CONFIG;
  }
  return nullptr;
}

bool GetUtf8Argument(napi_env env, napi_value value, std::string &output) {
  napi_valuetype valueType;
  if (!CheckNapiStatus(env, napi_typeof(env, value, &valueType))) {
    return false;
  }
  if (valueType != napi_string) {
    napi_throw_type_error(env, "EINVAL", "Expected string");
    return false;
  }

  size_t length = 0;
  if (!CheckNapiStatus(
          env, napi_get_value_string_utf8(env, value, nullptr, 0, &length))) {
    return false;
  }
  if (length >= kMaximumArgumentBytes) {
    napi_throw_range_error(env, "EINVAL", "Arguments too long");
    return false;
  }

  output.assign(length + 1, '\0');
  size_t copied = 0;
  if (!CheckNapiStatus(env, napi_get_value_string_utf8(
                                env, value, output.data(), output.size(),
                                &copied))) {
    return false;
  }
  output.resize(copied);

  if (copied != length) {
    napi_throw_error(env, nullptr, "Registry argument changed while reading");
    return false;
  }
  if (output.find('\0') != std::string::npos) {
    napi_throw_type_error(env, "EINVAL",
                          "Registry arguments cannot contain null characters");
    return false;
  }
  return true;
}

struct RegistryRequest {
  HKEY hive = nullptr;
  std::wstring path;
  std::wstring name;
};

bool GetRegistryRequest(napi_env env, napi_callback_info info,
                        RegistryRequest &request) {
  std::array<napi_value, kArgumentCount> argv{};
  size_t argc = argv.size();
  if (!CheckNapiStatus(
          env, napi_get_cb_info(env, info, &argc, argv.data(), nullptr, nullptr))) {
    return false;
  }
  if (argc < argv.size()) {
    napi_throw_type_error(env, "EINVAL", "Wrong number of arguments");
    return false;
  }

  std::string hive;
  std::string path;
  std::string name;
  if (!GetUtf8Argument(env, argv[0], hive) ||
      !GetUtf8Argument(env, argv[1], path) ||
      !GetUtf8Argument(env, argv[2], name)) {
    return false;
  }

  request.hive = GetHive(hive);
  if (request.hive == nullptr) {
    napi_throw_type_error(env, "EINVAL", "Unknown registry hive");
    return false;
  }
  request.path = Utf8ToWide(path);
  request.name = Utf8ToWide(name);
  return true;
}

struct RegistryKeyCloser {
  void operator()(HKEY key) const noexcept {
    if (key != nullptr) {
      static_cast<void>(RegCloseKey(key));
    }
  }
};

using RegistryKey =
    std::unique_ptr<std::remove_pointer_t<HKEY>, RegistryKeyCloser>;

RegistryKey OpenRegistryKey(napi_env env, const RegistryRequest &request) {
  HKEY key = nullptr;
  if (RegOpenKeyExW(request.hive, request.path.c_str(), 0, KEY_READ, &key) !=
      ERROR_SUCCESS) {
    napi_throw_error(env, nullptr, "Unable to open registry key");
    return {};
  }
  return RegistryKey(key);
}

napi_value GetStringRegKeyImpl(napi_env env, napi_callback_info info) {
  RegistryRequest request;
  if (!GetRegistryRequest(env, info, request)) {
    return nullptr;
  }

  RegistryKey key = OpenRegistryKey(env, request);
  if (!key) {
    return nullptr;
  }

  std::array<wchar_t, 512> buffer{};
  DWORD bufferSize = static_cast<DWORD>(buffer.size() * sizeof(buffer[0]));
  DWORD type = 0;
  const LONG result = RegQueryValueExW(
      key.get(), request.name.c_str(), nullptr, &type,
      reinterpret_cast<LPBYTE>(buffer.data()), &bufferSize);

  if (result == ERROR_MORE_DATA) {
    napi_throw_range_error(env, nullptr, "Registry value too large");
    return nullptr;
  }
  if (result != ERROR_SUCCESS || (type != REG_SZ && type != REG_EXPAND_SZ)) {
    return nullptr;
  }
  if (bufferSize > buffer.size() * sizeof(buffer[0]) ||
      bufferSize % sizeof(buffer[0]) != 0) {
    napi_throw_error(env, nullptr, "Registry returned an invalid string size");
    return nullptr;
  }

  size_t wcharCount = bufferSize / sizeof(buffer[0]);
  if (wcharCount > 0 && buffer[wcharCount - 1] == L'\0') {
    wcharCount -= 1;
  }

  const std::string utf8Result = WideToUtf8(buffer.data(), wcharCount);
  napi_value napiResult;
  NAPI_CALL(env, napi_create_string_utf8(env, utf8Result.data(),
                                         utf8Result.size(), &napiResult));
  return napiResult;
}

napi_value GetStringRegKey(napi_env env, napi_callback_info info) noexcept {
  return InvokeSafely(env, [env, info]() { return GetStringRegKeyImpl(env, info); });
}

napi_value GetDWORDRegKeyImpl(napi_env env, napi_callback_info info) {
  RegistryRequest request;
  if (!GetRegistryRequest(env, info, request)) {
    return nullptr;
  }

  RegistryKey key = OpenRegistryKey(env, request);
  if (!key) {
    return nullptr;
  }

  DWORD value = 0;
  DWORD bufferSize = sizeof(value);
  DWORD type = 0;
  const LONG result = RegQueryValueExW(
      key.get(), request.name.c_str(), nullptr, &type,
      reinterpret_cast<LPBYTE>(&value), &bufferSize);
  if (result != ERROR_SUCCESS || type != REG_DWORD ||
      bufferSize != sizeof(value)) {
    return nullptr;
  }

  napi_value napiResult;
  NAPI_CALL(env, napi_create_uint32(env, value, &napiResult));
  return napiResult;
}

napi_value GetDWORDRegKey(napi_env env, napi_callback_info info) noexcept {
  return InvokeSafely(env, [env, info]() { return GetDWORDRegKeyImpl(env, info); });
}

#ifdef NATIVE_SANITIZE
napi_value TriggerAsanCanary(napi_env env, napi_callback_info info) noexcept {
  napi_value argument;
  size_t argc = 1;
  NAPI_CALL(env,
            napi_get_cb_info(env, info, &argc, &argument, nullptr, nullptr));
  if (argc != 1) {
    napi_throw_type_error(env, "EINVAL", "ASan canary requires an index");
    return nullptr;
  }

  uint32_t index = 0;
  NAPI_CALL(env, napi_get_value_uint32(env, argument, &index));
  auto allocation = std::make_unique<unsigned char[]>(1);
  allocation[index] = 0x5a; // Intentionally trips ASan when the test passes 1.

  napi_value result;
  NAPI_CALL(env, napi_get_undefined(env, &result));
  return result;
}
#endif

napi_value Init(napi_env env, napi_value exports) {
  napi_value getStringRegKey;
  NAPI_CALL(env, napi_create_function(env, "GetStringRegKey", NAPI_AUTO_LENGTH,
                                      GetStringRegKey, nullptr,
                                      &getStringRegKey));
  NAPI_CALL(env, napi_set_named_property(env, exports, "GetStringRegKey",
                                         getStringRegKey));

  napi_value getDWORDRegKey;
  NAPI_CALL(env, napi_create_function(env, "GetDWORDRegKey", NAPI_AUTO_LENGTH,
                                      GetDWORDRegKey, nullptr,
                                      &getDWORDRegKey));
  NAPI_CALL(env, napi_set_named_property(env, exports, "GetDWORDRegKey",
                                         getDWORDRegKey));

#ifdef NATIVE_SANITIZE
  napi_value triggerAsanCanary;
  NAPI_CALL(env,
            napi_create_function(env, "__triggerAsanCanary", NAPI_AUTO_LENGTH,
                                 TriggerAsanCanary, nullptr,
                                 &triggerAsanCanary));
  NAPI_CALL(env, napi_set_named_property(env, exports, "__triggerAsanCanary",
                                         triggerAsanCanary));
#endif
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init);

} // namespace
