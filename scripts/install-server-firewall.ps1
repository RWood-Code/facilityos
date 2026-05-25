# Run as Administrator on the DATA SERVER PC
# Opens Windows Firewall for FacilityOS LAN sync (port 3847)

$port = 3847
$ruleName = "FacilityOS Data Server"

$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Firewall rule already exists: $ruleName"
} else {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow -Profile Private,Domain
    Write-Host "Created firewall rule for TCP port $port (Private/Domain networks)"
}

Write-Host ""
Write-Host "Server URL for other terminals:"
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1).IPAddress
Write-Host "  http://${ip}:${port}"
