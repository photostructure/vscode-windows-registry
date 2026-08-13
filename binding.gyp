{
  "variables": {
    "native_analysis%": 0,
    "native_sanitize%": 0,
    "target_arch%": "<(target_arch)"
  },
  "targets": [
    {
      "target_name": "winregistry",
      "defines": [
        "NAPI_VERSION=8",
        "NOMINMAX",
        "WIN32_LEAN_AND_MEAN"
      ],
      "defines!": [
        "_HAS_EXCEPTIONS=0"
      ],
      "conditions": [
        ["OS=='win'", {
          "sources": [
            "src/winregistry.cc"
          ],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1,
              "WarningLevel": 4,
              "AdditionalOptions!": [
                "-std:c++20"
              ],
              "AdditionalOptions": [
                "/std:c++17",
                "/Zc:__cplusplus",
                "/Zc:throwingNew",
                "/permissive-",
                "/utf-8",
                "/Qspectre",
                "/guard:cf",
                "/sdl",
                "/we4146",
                "/we4244",
                "/we4267",
                "/ZH:SHA_256"
              ]
            },
            "VCLinkerTool": {
              "AdditionalOptions": [
                "/DYNAMICBASE",
                "/HIGHENTROPYVA",
                "/NXCOMPAT",
                "/GUARD:CF"
              ]
            }
          },
          "conditions": [
            ["target_arch=='x64'", {
              "msvs_settings": {
                "VCCLCompilerTool": {
                  "AdditionalOptions": [
                    "/Gy",
                    "/guard:ehcont"
                  ]
                },
                "VCLinkerTool": {
                  "AdditionalOptions": [
                    "/guard:ehcont",
                    "/CETCOMPAT"
                  ]
                }
              }
            }],
            ["target_arch=='arm64'", {
              "msvs_settings": {
                "VCCLCompilerTool": {
                  "AdditionalOptions": [
                    "/guard:signret"
                  ]
                }
              }
            }],
            ["native_analysis==1", {
              "msvs_settings": {
                "VCCLCompilerTool": {
                  "EnablePREfast": "true",
                  "WarnAsError": "true",
                  "AdditionalOptions": [
                    "/analyze:external-"
                  ]
                }
              }
            }],
            ["native_sanitize==1 and target_arch=='x64'", {
              "defines": [
                "NATIVE_SANITIZE=1"
              ],
              "msvs_settings": {
                "VCCLCompilerTool": {
                  "OmitFramePointers": "false",
                  "WholeProgramOptimization": "false",
                  "AdditionalOptions": [
                    "/fsanitize=address"
                  ]
                },
                "VCLinkerTool": {
                  "AdditionalOptions!": [
                    "/LTCG:INCREMENTAL"
                  ],
                  "AdditionalOptions": [
                    "/INCREMENTAL:NO"
                  ],
                  "LinkTimeCodeGeneration": 0
                }
              }
            }]
          ]
        }]
      ]
    }
  ]
}
