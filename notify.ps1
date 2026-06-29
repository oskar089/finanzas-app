<#
.SYNOPSIS
    Send Telegram notification from Gentle AI / OpenCode
.DESCRIPTION
    Sends a message to the configured Telegram bot.
    Requires: Bot Token and Chat ID (already configured)
.PARAMETER Message
    The message text to send (supports HTML: <b>, <i>, <code>, <a href="">)
.PARAMETER ParseMode
    "HTML" (default) or "MarkdownV2"
.EXAMPLE
    .\notify.ps1 -Message "Build completado ✅"
.EXAMPLE
    .\notify.ps1 -Message "<b>Error:</b> Tests fallaron" -ParseMode HTML
#>

param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$Message,

    [Parameter(Mandatory=$false)]
    [ValidateSet("HTML", "MarkdownV2")]
    [string]$ParseMode = "HTML"
)

$BOT_TOKEN = "8886676356:AAHaTRdIM467vT8zw5Hi1XJvFKViQQKGh3Y"
$CHAT_ID   = "1803817455"

$url = "https://api.telegram.org/bot$BOT_TOKEN/sendMessage"
$body = @{
    chat_id    = $CHAT_ID
    text       = $Message
    parse_mode = $ParseMode
} | ConvertTo-Json -Compress

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -ContentType "application/json" -Body $body
    if ($response.ok) {
        Write-Host "✅ Notificación enviada (message_id: $($response.result.message_id))" -ForegroundColor Green
    } else {
        Write-Host "❌ Error: $($response.description)" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "❌ Excepción: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}