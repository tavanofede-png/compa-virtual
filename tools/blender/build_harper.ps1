param([ValidateSet('full','build','export','render','presentation','poses')][string]$Mode='full')
$ErrorActionPreference='Stop'
& (Join-Path $PSScriptRoot 'build_companion_collection.ps1') -Character harper -Mode $Mode
