/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for
 *license information.
 *--------------------------------------------------------------------------------------------*/

#define WIN32_LEAN_AND_MEAN
#include <string>
#include <windows.h>

#include <node_api.h>

namespace {

#define NAPI_CALL(env, call)                                                   \
  do {                                                                         \
    napi_status status = (call);                                               \
    if (status != napi_ok) {                                                   \
      napi_throw_error((env), nullptr, "NAPI call failed");                    \
      return nullptr;                                                          \
    }                                                                          \
  } while (0)

// Convert a UTF-8 std::string to a UTF-16 std::wstring.
std::wstring Utf8ToWide(const std::string &utf8) {
  if (utf8.empty()) {
    return std::wstring();
  }
  int len = MultiByteToWideChar(CP_UTF8, 0, utf8.data(),
                                static_cast<int>(utf8.size()), nullptr, 0);
  if (len <= 0) {
    return std::wstring();
  }
  std::wstring wide(len, L'\0');
  MultiByteToWideChar(CP_UTF8, 0, utf8.data(), static_cast<int>(utf8.size()),
                      &wide[0], len);
  return wide;
}

// Convert a UTF-16 buffer (with known length in bytes) to a UTF-8 std::string.
std::string WideToUtf8(const wchar_t *wide, size_t wcharCount) {
  if (wcharCount == 0) {
    return std::string();
  }
  int len = WideCharToMultiByte(CP_UTF8, 0, wide, static_cast<int>(wcharCount),
                                nullptr, 0, nullptr, nullptr);
  if (len <= 0) {
    return std::string();
  }
  std::string utf8(len, '\0');
  WideCharToMultiByte(CP_UTF8, 0, wide, static_cast<int>(wcharCount),
                      &utf8[0], len, nullptr, nullptr);
  return utf8;
}

HKEY GetHive(const std::string &hkey) {
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

  return NULL;
}

napi_value GetStringRegKey(napi_env env, napi_callback_info info) {
  napi_value argv[3];
  size_t argc = 3;

  NAPI_CALL(env, napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr));

  // Check that we have 3 arguments - Hive, Path, Name
  if (argc < 3) {
    napi_throw_error(env, "EINVAL", "Wrong number of arguments");
    return nullptr;
  }

  // Retrieve the 3 arguments
  for (int i = 0; i < 3; i++) {
    napi_valuetype value_type;
    NAPI_CALL(env, napi_typeof(env, argv[i], &value_type));
    if (value_type != napi_string) {
      napi_throw_error(env, "EINVAL", "Expected string");
      return nullptr;
    }
  }

  size_t str_len = 0;
  const int MAX_LEN = 16383;

  NAPI_CALL(env,
            napi_get_value_string_utf8(env, argv[0], nullptr, 0, &str_len));
  if (str_len + 1 > MAX_LEN) {
    napi_throw_error(env, "EINVAL", "Arguments too long");
    return nullptr;
  }
  std::string hive_arg(str_len, '\0');
  NAPI_CALL(env, napi_get_value_string_utf8(env, argv[0], &hive_arg[0],
                                            str_len + 1, nullptr));
  HKEY hive = GetHive(hive_arg);

  NAPI_CALL(env,
            napi_get_value_string_utf8(env, argv[1], nullptr, 0, &str_len));
  if (str_len + 1 > MAX_LEN) {
    napi_throw_error(env, "EINVAL", "Arguments too long");
    return nullptr;
  }
  std::string path(str_len, '\0');
  NAPI_CALL(env, napi_get_value_string_utf8(env, argv[1], &path[0],
                                            str_len + 1, nullptr));

  NAPI_CALL(env,
            napi_get_value_string_utf8(env, argv[2], nullptr, 0, &str_len));
  if (str_len + 1 > MAX_LEN) {
    napi_throw_error(env, "EINVAL", "Arguments too long");
    return nullptr;
  }
  std::string name(str_len, '\0');
  NAPI_CALL(env, napi_get_value_string_utf8(env, argv[2], &name[0],
                                            str_len + 1, nullptr));

  if (hive == NULL) {
    napi_throw_error(env, nullptr, "Unable to open registry hive");
    return nullptr;
  }

  std::wstring widePath = Utf8ToWide(path);
  std::wstring wideName = Utf8ToWide(name);

  HKEY hKey;
  if (ERROR_SUCCESS !=
      RegOpenKeyExW(hive, widePath.c_str(), 0, KEY_READ, &hKey)) {
    napi_throw_error(env, nullptr, "Unable to open registry key");
    return nullptr;
  }

  wchar_t szBuffer[512];
  DWORD dwBufferSize = sizeof(szBuffer);
  DWORD dwType = 0;
  LONG rc = RegQueryValueExW(hKey, wideName.c_str(), 0, &dwType,
                             reinterpret_cast<LPBYTE>(szBuffer), &dwBufferSize);
  RegCloseKey(hKey);

  if (rc == ERROR_MORE_DATA) {
    napi_throw_error(env, nullptr, "Registry value too large");
    return nullptr;
  }

  if (rc != ERROR_SUCCESS) {
    return nullptr;
  }

  if (dwType != REG_SZ && dwType != REG_EXPAND_SZ) {
    return nullptr;
  }

  // dwBufferSize is in bytes; compute wchar count, excluding null terminator
  size_t wcharCount = dwBufferSize / sizeof(wchar_t);
  if (wcharCount > 0 && szBuffer[wcharCount - 1] == L'\0') {
    wcharCount--;
  }

  std::string utf8Result = WideToUtf8(szBuffer, wcharCount);

  napi_value napi_result;
  NAPI_CALL(env, napi_create_string_utf8(env, utf8Result.c_str(),
                                         utf8Result.length(), &napi_result));

  return napi_result;
}

napi_value GetDWORDRegKey(napi_env env, napi_callback_info info) {
  napi_value argv[3];
  size_t argc = 3;

  NAPI_CALL(env, napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr));

  // Check that we have 3 arguments - Hive, Path, Name
  if (argc < 3) {
    napi_throw_error(env, "EINVAL", "Wrong number of arguments");
    return nullptr;
  }

  // Retrieve the 3 arguments
  for (int i = 0; i < 3; i++) {
    napi_valuetype value_type;
    NAPI_CALL(env, napi_typeof(env, argv[i], &value_type));
    if (value_type != napi_string) {
      napi_throw_error(env, "EINVAL", "Expected string");
      return nullptr;
    }
  }

  size_t str_len = 0;
  const int MAX_LEN = 16383;

  NAPI_CALL(env,
            napi_get_value_string_utf8(env, argv[0], nullptr, 0, &str_len));
  if (str_len + 1 > MAX_LEN) {
    napi_throw_error(env, "EINVAL", "Arguments too long");
    return nullptr;
  }
  std::string hive_arg(str_len, '\0');
  NAPI_CALL(env, napi_get_value_string_utf8(env, argv[0], &hive_arg[0],
                                            str_len + 1, nullptr));
  HKEY hive = GetHive(hive_arg);

  NAPI_CALL(env,
            napi_get_value_string_utf8(env, argv[1], nullptr, 0, &str_len));
  if (str_len + 1 > MAX_LEN) {
    napi_throw_error(env, "EINVAL", "Arguments too long");
    return nullptr;
  }
  std::string path(str_len, '\0');
  NAPI_CALL(env, napi_get_value_string_utf8(env, argv[1], &path[0],
                                            str_len + 1, nullptr));

  NAPI_CALL(env,
            napi_get_value_string_utf8(env, argv[2], nullptr, 0, &str_len));
  if (str_len + 1 > MAX_LEN) {
    napi_throw_error(env, "EINVAL", "Arguments too long");
    return nullptr;
  }
  std::string name(str_len, '\0');
  NAPI_CALL(env, napi_get_value_string_utf8(env, argv[2], &name[0],
                                            str_len + 1, nullptr));

  if (hive == NULL) {
    napi_throw_error(env, nullptr, "Unable to open registry hive");
    return nullptr;
  }

  std::wstring widePath = Utf8ToWide(path);
  std::wstring wideName = Utf8ToWide(name);

  HKEY hKey;
  if (ERROR_SUCCESS !=
      RegOpenKeyExW(hive, widePath.c_str(), 0, KEY_READ, &hKey)) {
    napi_throw_error(env, nullptr, "Unable to open registry key");
    return nullptr;
  }

  DWORD dwValue = 0;
  DWORD dwBufferSize = sizeof(dwValue);
  DWORD dwType = 0;
  LONG result = RegQueryValueExW(hKey, wideName.c_str(), 0, &dwType,
                                 reinterpret_cast<LPBYTE>(&dwValue),
                                 &dwBufferSize);
  RegCloseKey(hKey);

  if (result != ERROR_SUCCESS || dwType != REG_DWORD) {
    return nullptr;
  }

  napi_value napi_result;
  NAPI_CALL(env, napi_create_uint32(env, dwValue, &napi_result));

  return napi_result;
}

napi_value Init(napi_env env, napi_value exports) {
  napi_value getStringRegKey;
  NAPI_CALL(env, napi_create_function(env, "GetStringRegKey", NAPI_AUTO_LENGTH,
                                      GetStringRegKey, NULL, &getStringRegKey));
  NAPI_CALL(env, napi_set_named_property(env, exports, "GetStringRegKey",
                                         getStringRegKey));

  napi_value getDWORDRegKey;
  NAPI_CALL(env, napi_create_function(env, "GetDWORDRegKey", NAPI_AUTO_LENGTH,
                                      GetDWORDRegKey, NULL, &getDWORDRegKey));
  NAPI_CALL(env, napi_set_named_property(env, exports, "GetDWORDRegKey",
                                         getDWORDRegKey));

  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init);
} // namespace
