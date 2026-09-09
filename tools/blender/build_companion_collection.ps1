$ErrorActionPreference = "Stop"
$blender = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
$script = Join-Path $PSScriptRoot "build_companion_collection.py"
$character = if ($args.Count -gt 0) { $args[0] } else { "all" }
& $blender --background --python $script -- $character
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
