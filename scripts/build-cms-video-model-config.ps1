param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [Parameter(Mandatory = $true)]
  [string]$OutputDir
)

$ErrorActionPreference = 'Stop'

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$source = Get-Content -LiteralPath $InputPath -Raw -Encoding UTF8 | ConvertFrom-Json
$properties = $source.schema.properties

if ($properties.PSObject.Properties.Name -contains 'video') {
  $properties.PSObject.Properties.Remove('video')
}

$step1Path = Join-Path $OutputDir 'pottery_submissions_2026-step1-remove-video.json'
$step2Path = Join-Path $OutputDir 'pottery_submissions_2026-step2-video-object.json'

$source | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $step1Path -Encoding UTF8

$videoId = 'v26meta1'
$videoProperties = [ordered]@{}
$videoList = @()

function ConvertFrom-CodePoints {
  param([string]$CodePoints)
  return (($CodePoints -split ' ') | ForEach-Object {
    [char][Convert]::ToInt32($_, 16)
  }) -join ''
}

$childDefinitions = @(
  @{ Name = 'fileId'; Title = ConvertFrom-CodePoints '4e91 5b58 50a8 6587 4ef6 0049 0044'; Type = 'string'; Id = 'v26fid01' },
  @{ Name = 'fileName'; Title = ConvertFrom-CodePoints '6587 4ef6 540d 79f0'; Type = 'string'; Id = 'v26fnam1' },
  @{ Name = 'sizeBytes'; Title = ConvertFrom-CodePoints '6587 4ef6 5927 5c0f ff08 5b57 8282 ff09'; Type = 'number'; Id = 'v26size1' },
  @{ Name = 'format'; Title = ConvertFrom-CodePoints '89c6 9891 683c 5f0f'; Type = 'string'; Id = 'v26fmt01' },
  @{ Name = 'durationSeconds'; Title = ConvertFrom-CodePoints '65f6 957f ff08 79d2 ff09'; Type = 'number'; Id = 'v26dur01' },
  @{ Name = 'width'; Title = ConvertFrom-CodePoints '89c6 9891 5bbd 5ea6'; Type = 'number'; Id = 'v26wid01' },
  @{ Name = 'height'; Title = ConvertFrom-CodePoints '89c6 9891 9ad8 5ea6'; Type = 'number'; Id = 'v26hei01' },
  @{ Name = 'aspectRatio'; Title = ConvertFrom-CodePoints '89c6 9891 6bd4 4f8b'; Type = 'string'; Id = 'v26asp01' },
  @{ Name = 'uploadStatus'; Title = ConvertFrom-CodePoints '4e0a 4f20 72b6 6001'; Type = 'string'; Id = 'v26stat1' }
)

$childIndex = 2
foreach ($definition in $childDefinitions) {
  $child = [ordered]@{
    'x-required' = $false
    'x-keyPath' = ''
    'x-id' = $definition.Id
    format = ''
    name = $definition.Name
    description = ''
    pId = $videoId
    type = $definition.Type
    'x-index' = $childIndex
    title = $definition.Title
    'x-unique' = $false
  }

  $videoProperties[$definition.Name] = $child
  $videoList += [pscustomobject]$child
  $childIndex += 2
}

$video = [ordered]@{
  'x-required' = $false
  'x-keyPath' = ''
  'x-id' = $videoId
  format = ''
  description = ConvertFrom-CodePoints '7ad9 5185 5c55 793a 89c6 9891'
  type = 'object'
  title = ConvertFrom-CodePoints '7ad9 5185 5c55 793a 89c6 9891'
  list = $videoList
  properties = [pscustomobject]$videoProperties
  'x-unique' = $false
  required = @()
}

$properties | Add-Member -NotePropertyName 'video' -NotePropertyValue ([pscustomobject]$video)
$source | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $step2Path -Encoding UTF8

[pscustomobject]@{
  Step1 = $step1Path
  Step2 = $step2Path
}
