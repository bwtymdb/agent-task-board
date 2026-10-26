param(
  [Parameter(Mandatory = $true)][string]$Title
)

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms

function Invoke-UiElement([System.Windows.Automation.AutomationElement]$Element) {
  $current = $Element
  for ($i = 0; $i -lt 6 -and $current; $i++) {
    try {
      $pattern = $current.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
      $pattern.Invoke()
      return $true
    } catch {}
    try {
      $pattern = $current.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
      $pattern.Select()
      return $true
    } catch {}
    try {
      $pattern = $current.GetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern)
      $pattern.DoDefaultAction()
      return $true
    } catch {}
    $current = [System.Windows.Automation.TreeWalker]::ControlViewWalker.GetParent($current)
  }
  return $false
}

$process = Get-Process -Name 'Kimi Code' -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $process) {
  Write-Error 'Kimi Code desktop window is not ready.'
  exit 1
}

$condition = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::ProcessIdProperty,
  $process.Id
)
$window = [System.Windows.Automation.AutomationElement]::RootElement.FindFirst(
  [System.Windows.Automation.TreeScope]::Children,
  $condition
)
if (-not $window) {
  Write-Error 'Kimi Code desktop window was not found.'
  exit 1
}

$allElements = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
$searchOpened = $false
foreach ($element in $allElements) {
  if ($element.Current.Name -match 'Ctrl K$') {
    $searchOpened = Invoke-UiElement $element
    if ($searchOpened) { break }
  }
}
if (-not $searchOpened) {
  Write-Error 'Kimi Code session search button is unavailable.'
  exit 1
}
Start-Sleep -Milliseconds 500

$editCondition = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
  [System.Windows.Automation.ControlType]::Edit
)
$edits = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $editCondition)
$searchReady = $false
foreach ($edit in $edits) {
  try {
    $value = $edit.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
    $value.SetValue($Title)
    $searchReady = $true
    break
  } catch {}
}
if (-not $searchReady) {
  Write-Error 'Kimi Code session search is unavailable.'
  exit 1
}

Start-Sleep -Milliseconds 700
$titleCondition = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::NameProperty,
  $Title
)
$matches = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $titleCondition)
foreach ($match in $matches) {
  if (Invoke-UiElement $match) {
    Write-Output 'selected'
    exit 0
  }
}

Write-Error "No exact Kimi Code session title match: $Title"
exit 1
