$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$blenderCommand = Get-Command blender -ErrorAction SilentlyContinue
$blenderPath = if ($blenderCommand) {
  $blenderCommand.Source
} else {
  Get-ChildItem "C:\Program Files\Blender Foundation" -Recurse -Filter blender.exe -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1 -ExpandProperty FullName
}

if (-not $blenderPath) {
  throw "Blender no está instalado. Descargalo desde https://www.blender.org/download/"
}

Push-Location $projectRoot
try {
  & $blenderPath --background --python "tools\blender\build_harper.py"
  if ($LASTEXITCODE -ne 0) {
    throw "Blender terminó con código $LASTEXITCODE"
  }
  $required = @(
    "packages\assets\3d\source\harper-master-v1.blend",
    "packages\assets\3d\compa-harper-premium.glb",
    "packages\assets\3d\previews\compa-harper-premium.png",
    "packages\assets\3d\source\harper-master-v1.report.json"
  )
  foreach ($file in $required) {
    if (-not (Test-Path -LiteralPath $file)) {
      throw "La producción no generó $file"
    }
  }
} finally {
  Pop-Location
}

