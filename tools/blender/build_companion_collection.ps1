param(
  [ValidateSet('all','nova','jay','milo','zoe','sky','harper','river','aria')][string]$Character = 'all',
  [ValidateSet('full','build','export','render','presentation','poses')][string]$Mode = 'full'
)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$blenderPath = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
if (-not (Test-Path -LiteralPath $blenderPath)) { $blenderPath = (Get-Command blender -ErrorAction Stop).Source }
Push-Location $projectRoot
try {
  $characters = if ($Character -eq 'all') { @('nova','jay','milo','zoe','sky','harper','river','aria') } else { @($Character) }
  $modes = if ($Mode -eq 'full') { @('build','export','render') } else { @($Mode) }
  foreach ($stage in $modes) {
    foreach ($characterId in $characters) {
      & $blenderPath --background --python-exit-code 1 --python scripts/character_premium_pipeline.py -- $stage $characterId
      if ($LASTEXITCODE -ne 0) { throw "Falló $stage para $characterId" }
    }
  }
  if ($Mode -eq 'full' -and $Character -in @('all','harper')) {
    & $blenderPath --background --python-exit-code 1 --python scripts/character_premium_pipeline.py -- presentation
    if ($LASTEXITCODE -ne 0) { throw 'Fallaron las vistas de presentación' }
  }
  if ($Character -eq 'all' -and $Mode -in @('full','export')) {
    & $blenderPath --background --python-exit-code 1 --python tools/blender/audit_premium_exports.py
    if ($LASTEXITCODE -ne 0) { throw 'Falló la reimportación de los GLB' }
  }
} finally { Pop-Location }
