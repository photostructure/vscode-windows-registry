{
  "targets": [
    {
      "target_name": "winregistry",
      "conditions": [
        ["OS=='win'", {
          "sources": [
            "src/winregistry.cc"
          ],
          "msvs_configuration_attributes": {
            "SpectreMitigation": "Spectre"
          },
          "conditions": [
            ["target_arch=='x64'", {
              "defines": [
                "_M_X64",
                "_WIN64"
              ],
              "msvs_settings": {
                "VCCLCompilerTool": {
                  "AdditionalOptions": [
                    "/Qspectre",
                    "/guard:cf",
                    "/sdl",
                    "/W3",
                    "/we4146",
                    "/we4244",
                    "/we4267",
                    "/ZH:SHA_256"
                  ]
                },
                "VCLinkerTool": {
                  "AdditionalOptions": [
                    "/DYNAMICBASE",
                    "/guard:cf",
                    "/CETCOMPAT"
                  ]
                }
              }
            }],
            ["target_arch=='arm64'", {
              "defines": [
                "_M_ARM64",
                "_WIN64"
              ],
              "msvs_settings": {
                "VCCLCompilerTool": {
                  "AdditionalOptions": [
                    "/guard:cf",
                    "/sdl",
                    "/W3",
                    "/we4146",
                    "/we4244",
                    "/we4267",
                    "/ZH:SHA_256"
                  ]
                },
                "VCLinkerTool": {
                  "AdditionalOptions": [
                    "/DYNAMICBASE",
                    "/guard:cf"
                  ]
                }
              }
            }]
          ]
        }]
      ]
    }
  ]
}
