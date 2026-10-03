<#
  Instalador de Local Co-op para RPG Maker MV/MZ.
  Uso:  .\install.ps1 -GamePath "D:\Juegos\Fear & Hunger 2"
  Copia los plugins, registra los plugins en js\plugins.js (con copia de seguridad) y listo.
#>
param(
    [Parameter(Mandatory = $true)][string]$GamePath,
    [switch]$Uninstall,
    # auto = detecta por el titulo del juego. lookoutside = solo el plugin base. fearhunger = base + acciones de P2 (disparo previo al combate).
    [ValidateSet('auto', 'lookoutside', 'fearhunger', 'generic')][string]$Profile = 'auto'
)

$ErrorActionPreference = 'Stop'
$allNames = @('LookOutsideOnline', 'LocalCoop_FearHunger_Actions', 'LookOutsideOnline_Actions')

$candidates = @("$GamePath\js", "$GamePath\www\js")
$jsDir = $candidates | Where-Object { Test-Path "$_\plugins.js" } | Select-Object -First 1
if (-not $jsDir) { throw "No encuentro js\plugins.js en '$GamePath'. Apunta a la carpeta donde esta Game.exe (o index.html)." }

$pluginDir = Join-Path $jsDir 'plugins'
$pluginsJs = Join-Path $jsDir 'plugins.js'
$src = Join-Path $PSScriptRoot 'plugins'

# Perfil: el plugin de disparo previo al combate solo va en juegos que lo tienen (Fear & Hunger 2)
if ($Profile -eq 'auto') {
    $title = ''
    foreach ($d in @("$GamePath\data", "$GamePath\www\data")) {
        if (Test-Path "$d\System.json") { $title = [regex]::Match([IO.File]::ReadAllText("$d\System.json"), '"gameTitle"\s*:\s*"([^"]*)"').Groups[1].Value; break }
    }
    if ($title -match 'look\s*outside') { $Profile = 'lookoutside' }
    elseif ($title -match 'fear|hunger|termina') { $Profile = 'fearhunger' }
    else { $Profile = 'generic' }
    Write-Host "Juego detectado: '$title' -> perfil $Profile"
}
$names = @('LookOutsideOnline')
if ($Profile -eq 'fearhunger') { $names += 'LocalCoop_FearHunger_Actions' }
$text = [IO.File]::ReadAllText($pluginsJs)

if ($Uninstall) {
    Copy-Item $pluginsJs "$pluginsJs.coop-uninstall.bak" -Force
    foreach ($n in $allNames) {
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
