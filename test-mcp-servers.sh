#!/bin/bash
# MCP Server Diagnostic Script

echo "=== MCP Server Diagnostics ==="
echo ""

echo "1. Checking uvx installation..."
export PATH="$HOME/.local/bin:$PATH"
which uvx && uvx --version || echo "❌ uvx not found"
echo ""

echo "2. Checking Serena installation..."
uvx --from serena-agent serena --version 2>&1 || echo "❌ Serena not accessible"
echo ""

echo "3. Checking Python..."
which python3 && python3 --version || echo "❌ python3 not found"
echo ""

echo "4. Checking .serena project..."
ls /c/Gauntlet/CollabBoard/.serena/project.yml && echo "✓ Serena project exists" || echo "❌ No Serena project"
echo ""

echo "5. Testing Serena MCP server startup..."
cd /c/Gauntlet/CollabBoard
timeout 5 uvx --from serena-agent serena-mcp-server --project-from-cwd 2>&1 &
SERVER_PID=$!
sleep 2
if ps -p $SERVER_PID > /dev/null; then
    echo "✓ Serena MCP server started (PID: $SERVER_PID)"
    kill $SERVER_PID 2>/dev/null
else
    echo "❌ Serena MCP server failed to start"
fi
echo ""

echo "6. Testing Semantic Navigator server..."
timeout 3 python3 /c/Gauntlet/CollabBoard/mcp-semantic-navigator/server.py 2>&1 &
NAV_PID=$!
sleep 1
if ps -p $NAV_PID > /dev/null; then
    echo "✓ Semantic Navigator started (PID: $NAV_PID)"
    kill $NAV_PID 2>/dev/null
else
    echo "❌ Semantic Navigator failed to start"
fi
echo ""

echo "7. Checking Claude Code config..."
if [ -f ~/.config/claude/claude_desktop_config.json ]; then
    echo "✓ Claude config exists at: ~/.config/claude/claude_desktop_config.json"
    cat ~/.config/claude/claude_desktop_config.json
else
    echo "❌ No Claude config found"
fi
echo ""

echo "8. Checking Antigravity/VSCode config..."
if [ -f "$APPDATA/Code/User/settings.json" ]; then
    echo "✓ VSCode settings exist"
    grep -A 20 '"claude.mcpServers"' "$APPDATA/Code/User/settings.json" || echo "❌ No claude.mcpServers found in settings"
else
    echo "❌ VSCode settings not found"
fi
echo ""

echo "=== Diagnostics Complete ==="
echo ""
echo "Next steps:"
echo "1. For Antigravity/VSCode: Reload window (Ctrl+Shift+P → 'Developer: Reload Window')"
echo "2. Start a NEW conversation (not this one)"
echo "3. Ask Claude: 'What MCP tools do you have access to?'"
echo ""
