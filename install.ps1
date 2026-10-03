<#
  Instalador de Local Co-op para RPG Maker MV/MZ.
  Uso:  .\install.ps1 -GamePath "D:\Juegos\Fear & Hunger 2"
  Copia los plugins, registra los plugins en js\plugins.js (con copia de seguridad) y listo.
#>
param(
    [Parameter(Mandatory = $true)][string]$GamePath,
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$names = @('LookOutsideOnline', 'LookOutsideOnline_Actions')

$candidates = @("$GamePath\js", "$GamePath\www\js")
$jsDir = $candidates | Where-Object { Test-Path "$_\plugins.js" } | Select-Object -First 1
if (-not $jsDir) { throw "No encuentro js\plugins.js en '$GamePath'. Apunta a la carpeta donde esta Game.exe (o index.html)." }

$pluginDir = Join-Path $jsDir 'plugins'
$pluginsJs = Join-Path $jsDir 'plugins.js'
$src = Join-Path $PSScriptRoot 'plugins'
$text = [IO.File]::ReadAllText($pluginsJs)

if ($Uninstall) {
    Copy-Item $pluginsJs "$pluginsJs.coop-uninstall.bak" -Force
    foreach ($n in $names) {
        $text = [regex]::Replace($text, ',?\s*\{\s*"name"\s*:\s*"' + $n + '".*?\}\s*(?=[,\]])', '', 'Singleline')
        Remove-Item (Join-Path $pluginDir "$n.js") -ErrorAction SilentlyContinue
    }
    [IO.File]::WriteAllText($pluginsJs, $text)
    Write-Host 'Desinstalado.'
    return
}

$bak = "$pluginsJs.coop.bak"
if (-not (Test-Path $bak)) { Copy-Item $pluginsJs $bak }

foreach ($n in $names) {
    Copy-Item (Join-Path $src "$n.js") (Join-Path $pluginDir "$n.js") -Force
    if ($text -notmatch '"name"\s*:\s*"' + $n + '"') {
        $entry = @"

    {
        "name": "$n",
        "status": true,
        "description": "Local Co-op",
        "parameters": {}
    }
"@
        $idx = $text.LastIndexOf(']')
        $head = $text.Substring(0, $idx).TrimEnd()
        $text = $head + ",`n" + $entry.TrimStart("`r", "`n") + "`n" + $text.Substring($idx)
        Write-Host "Registrado: $n"
    } else {
        Write-Host "Ya estaba registrado: $n (archivo actualizado)"
    }
}
[IO.File]::WriteAllText($pluginsJs, $text)
Write-Host "Listo. Copia de seguridad: $bak"
Write-Host 'Abre el juego, y en el mapa pulsa X para que se una el Jugador 2.'
