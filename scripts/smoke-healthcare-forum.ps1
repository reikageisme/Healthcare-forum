[CmdletBinding()]
param(
  [string]$ApiBaseUrl = '',
  [string]$ModeratorEmail = '',
  [string]$ModeratorPassword = '',
  [string[]]$AssetBaseUrls = @()
)

$ErrorActionPreference = 'Stop'

if (-not $ApiBaseUrl) {
  $ApiBaseUrl = if ($env:SMOKE_API_BASE_URL) { $env:SMOKE_API_BASE_URL } else { 'http://localhost:8000/api/v1' }
}
if (-not $ModeratorEmail) { $ModeratorEmail = $env:SMOKE_MODERATOR_EMAIL }
if (-not $ModeratorPassword) { $ModeratorPassword = $env:SMOKE_MODERATOR_PASSWORD }
if (-not $ModeratorEmail -or -not $ModeratorPassword) {
  throw 'Set SMOKE_MODERATOR_EMAIL and SMOKE_MODERATOR_PASSWORD, or pass both moderator parameters.'
}
if ($AssetBaseUrls.Count -eq 0) {
  $configuredAssets = $env:SMOKE_ASSET_BASE_URLS
  $AssetBaseUrls = if ($configuredAssets) {
    $configuredAssets -split ','
  } else {
    @($ApiBaseUrl -replace '/api/v1/?$', '')
  }
}

$ApiBaseUrl = $ApiBaseUrl.TrimEnd('/')

function Invoke-ForumJson {
  param(
    [Parameter(Mandatory)] [ValidateSet('GET', 'POST', 'PUT', 'PATCH', 'DELETE')] [string]$Method,
    [Parameter(Mandatory)] [string]$Path,
    [string]$Token,
    [object]$Body
  )

  $headers = @{}
  if ($Token) { $headers.Authorization = "Bearer $Token" }
  $request = @{
    Uri = "$ApiBaseUrl$Path"
    Method = $Method
    Headers = $headers
    ErrorAction = 'Stop'
  }
  if ($null -ne $Body) {
    $request.ContentType = 'application/json'
    $request.Body = $Body | ConvertTo-Json -Depth 10
  }

  try {
    $response = Invoke-WebRequest @request
    $raw = $response.Content
    $parsed = if ($raw) { $raw | ConvertFrom-Json } else { $null }
    return [PSCustomObject]@{ StatusCode = [int]$response.StatusCode; Body = $parsed }
  } catch {
    $response = $_.Exception.Response
    if ($null -eq $response) { throw }
    if ($response.PSObject.Properties.Name -contains 'Content') {
      $raw = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    } else {
      $reader = [System.IO.StreamReader]::new($response.GetResponseStream())
      try { $raw = $reader.ReadToEnd() } finally { $reader.Dispose() }
    }
    $parsed = if ($raw) { $raw | ConvertFrom-Json } else { $null }
    return [PSCustomObject]@{ StatusCode = [int]$response.StatusCode; Body = $parsed }
  }
}

function Assert-Status {
  param(
    [Parameter(Mandatory)]$Response,
    [Parameter(Mandatory)][int]$Expected,
    [Parameter(Mandatory)][string]$Action
  )
  if ($Response.StatusCode -ne $Expected) {
    $detail = if ($Response.Body.detail) { " Detail: $($Response.Body.detail)" } else { '' }
    throw "$Action expected HTTP $Expected but received $($Response.StatusCode).$detail"
  }
}

function Login-ForumUser {
  param([string]$Email, [string]$Password)
  $response = Invoke-ForumJson -Method POST -Path '/auth/login' -Body @{
    email = $Email
    password = $Password
  }
  Assert-Status $response 200 "Login for $Email"
  if (-not $response.Body.access_token -or -not $response.Body.refresh_token) {
    throw "Login for $Email did not return both tokens."
  }
  return $response.Body
}

$suffix = [Guid]::NewGuid().ToString('N')
$userEmail = "smoke-$suffix@example.test"
$username = "smoke_$($suffix.Substring(0, 12))"
$userPassword = 'SmokePassword123!'

$registered = Invoke-ForumJson -Method POST -Path '/auth/register' -Body @{
  email = $userEmail
  username = $username
  password = $userPassword
}
Assert-Status $registered 201 'Register smoke user'
if ($registered.Body.token_type -ne 'bearer') { throw 'Registration did not return bearer tokens.' }

$userTokens = Login-ForumUser -Email $userEmail -Password $userPassword
$moderatorTokens = Login-ForumUser -Email $ModeratorEmail -Password $ModeratorPassword

$created = Invoke-ForumJson -Method POST -Path '/posts' -Token $userTokens.access_token -Body @{
  title = "Smoke post $suffix"
  content = '<p>Smoke content with enough visible text.</p>'
  post_type = 'article'
}
Assert-Status $created 201 'Create smoke post'
if ($created.Body.status -ne 'pending') { throw "Expected a regular user post to be pending, got $($created.Body.status)." }
$postId = [string]$created.Body.id

$approved = Invoke-ForumJson -Method POST -Path "/admin/posts/$postId/approve" -Token $moderatorTokens.access_token
Assert-Status $approved 200 'Approve smoke post'
if ($approved.Body.post.status -ne 'approved') { throw 'Approval response did not contain an approved post.' }

$detail = Invoke-ForumJson -Method GET -Path "/posts/$postId"
Assert-Status $detail 200 'Read approved smoke post'
if ($detail.Body.id -ne $postId -or $detail.Body.status -ne 'approved') { throw 'Public post detail contract did not match.' }

$comment = Invoke-ForumJson -Method POST -Path "/posts/$postId/comments" -Token $userTokens.access_token -Body @{
  content = '<p>Smoke comment.</p>'
}
Assert-Status $comment 201 'Create smoke comment'

$reaction = Invoke-ForumJson -Method POST -Path "/posts/$postId/reactions" -Token $userTokens.access_token -Body @{
  reaction_type = 'helpful'
}
Assert-Status $reaction 200 'Toggle smoke reaction'

$bookmark = Invoke-ForumJson -Method POST -Path "/posts/$postId/bookmark" -Token $userTokens.access_token
Assert-Status $bookmark 200 'Create smoke bookmark'
if (-not $bookmark.Body.is_bookmarked) { throw 'Bookmark response did not report a saved bookmark.' }

$report = Invoke-ForumJson -Method POST -Path '/reports' -Token $userTokens.access_token -Body @{
  target_type = 'post'
  target_id = $postId
  reason = 'Smoke report'
}
Assert-Status $report 201 'Create smoke report'

$removed = Invoke-ForumJson -Method DELETE -Path "/admin/reports/$($report.Body.id)/content" -Token $moderatorTokens.access_token
Assert-Status $removed 200 'Remove reported smoke post'
if (-not $removed.Body.target_exists) { throw 'Atomic report action did not report an existing target.' }

$hidden = Invoke-ForumJson -Method GET -Path "/posts/$postId"
Assert-Status $hidden 404 'Confirm removed smoke post is hidden'

if ($PSVersionTable.PSVersion.Major -lt 7) {
  throw 'Upload smoke requires PowerShell 7 or newer because it uses Invoke-WebRequest -Form.'
}

$uploadTemp = [System.IO.Path]::GetTempFileName()
$assetTemp = [System.IO.Path]::GetTempFileName()
try {
  # A 1x1 transparent PNG. The backend still validates the decoded format.
  $png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
  [System.IO.File]::WriteAllBytes($uploadTemp, [Convert]::FromBase64String($png))
  $uploadFile = Get-Item -LiteralPath $uploadTemp
  $uploadRequest = @{
    Uri = "$ApiBaseUrl/upload"
    Method = 'POST'
    Headers = @{ Authorization = "Bearer $($userTokens.access_token)" }
    Form = @{ file = $uploadFile }
    ErrorAction = 'Stop'
  }
  $uploadResponse = Invoke-WebRequest @uploadRequest
  Assert-Status ([PSCustomObject]@{ StatusCode = [int]$uploadResponse.StatusCode; Body = $uploadResponse.Content | ConvertFrom-Json }) 201 'Upload smoke image'
  $uploadBody = $uploadResponse.Content | ConvertFrom-Json
  if (-not $uploadBody.url -or $uploadBody.content_type -ne 'image/png') { throw 'Upload response did not contain the expected PNG contract.' }

  foreach ($assetBase in $AssetBaseUrls) {
    $assetUri = $assetBase.TrimEnd('/') + $uploadBody.url
    $assetResponse = Invoke-WebRequest -Uri $assetUri -Method GET -OutFile $assetTemp -ErrorAction Stop
    Assert-Status ([PSCustomObject]@{ StatusCode = [int]$assetResponse.StatusCode; Body = $null }) 200 "Retrieve upload through $assetBase"
    $bytes = [System.IO.File]::ReadAllBytes($assetTemp)
    if ($bytes.Length -ne [int]$uploadBody.size) {
      throw "Upload retrieved through $assetBase has $($bytes.Length) bytes; expected $($uploadBody.size)."
    }
  }
} finally {
  if (Test-Path -LiteralPath $uploadTemp) { Remove-Item -LiteralPath $uploadTemp -Force }
  if (Test-Path -LiteralPath $assetTemp) { Remove-Item -LiteralPath $assetTemp -Force }
}

Write-Output 'Healthcare Forum smoke passed for register, moderation, interaction, report deletion, and upload retrieval.'
