# Install MCP Servers to Claude Code

This guide shows you how to add **Serena** and **Semantic Navigator** MCP servers to Claude Code.

## What You're Installing

### 1. Serena MCP Server
- **26 semantic code tools** for precise editing and navigation
- **LSP-powered** symbol analysis
- **90 TypeScript files indexed** in CollabBoard

### 2. Semantic Navigator MCP Server
- **2 tools** for high-level architecture overview
- **Pattern-based clustering** to understand codebase structure
- **Free local embeddings** (no API keys needed)

---

## Installation Steps

### Step 1: Locate Your Claude Code Config File

The config file location depends on your OS:

**Windows:**
```
C:\Users\<YourUsername>\AppData\Roaming\Claude\claude_desktop_config.json
```

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Linux:**
```
~/.config/Claude/claude_desktop_config.json
```

**To find it quickly on Windows:**
1. Press `Win + R`
2. Type: `%APPDATA%\Claude`
3. Press Enter
4. Look for `claude_desktop_config.json`

### Step 2: Backup Your Existing Config (if it exists)

If you already have a config file, make a backup first:

**Windows:**
```powershell
copy "%APPDATA%\Claude\claude_desktop_config.json" "%APPDATA%\Claude\claude_desktop_config.backup.json"
```

**macOS/Linux:**
```bash
cp ~/Library/Application\ Support/Claude/claude_desktop_config.json ~/Library/Application\ Support/Claude/claude_desktop_config.backup.json
```

### Step 3: Add MCP Servers to Config

#### Option A: If you have NO existing config file

Copy the entire config from `docs/claude_desktop_config.json` to the location above.

**Windows Command:**
```powershell
mkdir "%APPDATA%\Claude" -ErrorAction SilentlyContinue
copy "C:\Gauntlet\CollabBoard\docs\claude_desktop_config.json" "%APPDATA%\Claude\claude_desktop_config.json"
```

#### Option B: If you ALREADY have a config file

Open your existing `claude_desktop_config.json` and merge the MCP servers.

**If your file is empty or has `{}`:**
```json
{
  "mcpServers": {
    "serena": {
      "command": "uvx",
      "args": [
        "--from",
        "serena-agent",
        "serena-mcp-server",
        "--project-from-cwd"
      ],
      "env": {
        "PATH": "C:\\Users\\paulk\\.local\\bin;${PATH}"
      }
    },
    "semantic-navigator": {
      "command": "python",
      "args": [
        "C:\\Gauntlet\\CollabBoard\\mcp-semantic-navigator\\server.py"
      ],
      "env": {
        "PYTHONPATH": "C:\\Gauntlet\\CollabBoard\\mcp-semantic-navigator"
      }
    }
  }
}
```

**If you already have other MCP servers:**
Add the `serena` and `semantic-navigator` entries inside your existing `mcpServers` object:

```json
{
  "mcpServers": {
    "existing-server": {
      "command": "...",
      "args": ["..."]
    },
    "serena": {
      "command": "uvx",
      "args": [
        "--from",
        "serena-agent",
        "serena-mcp-server",
        "--project-from-cwd"
      ],
      "env": {
        "PATH": "C:\\Users\\paulk\\.local\\bin;${PATH}"
      }
    },
    "semantic-navigator": {
      "command": "python",
      "args": [
        "C:\\Gauntlet\\CollabBoard\\mcp-semantic-navigator\\server.py"
      ],
      "env": {
        "PYTHONPATH": "C:\\Gauntlet\\CollabBoard\\mcp-semantic-navigator"
      }
    }
  }
}
```

**Important for macOS/Linux:** Use forward slashes and remove the Windows PATH syntax:
```json
{
  "mcpServers": {
    "serena": {
      "command": "uvx",
      "args": [
        "--from",
        "serena-agent",
        "serena-mcp-server",
        "--project-from-cwd"
      ]
    },
    "semantic-navigator": {
      "command": "python3",
      "args": [
        "/path/to/CollabBoard/mcp-semantic-navigator/server.py"
      ]
    }
  }
}
```

### Step 4: Verify Config File is Valid JSON

**Windows PowerShell:**
```powershell
Get-Content "$env:APPDATA\Claude\claude_desktop_config.json" | ConvertFrom-Json
```

If you get errors, check for:
- Missing commas between objects
- Extra commas before closing braces
- Mismatched quotes
- Backslashes in Windows paths (use `\\` not `\`)

### Step 5: Restart Claude Code

**IMPORTANT:** Completely close and restart Claude Code for changes to take effect.

1. Close all Claude Code windows
2. Quit Claude Code completely (check system tray/menu bar)
3. Relaunch Claude Code
4. Open the CollabBoard project directory

---

## Verify Installation

After restarting Claude Code, open a new conversation and ask:

### Test Serena:
```
"Use Serena to find the useBoard symbol"
```

**Expected:** You should see Claude call a tool like `serena_find_symbol`

### Test Semantic Navigator:
```
"Give me a semantic overview of the codebase"
```

**Expected:** You should see Claude call `get_cluster_overview`

### Check Available Tools:
```
"What MCP tools do you have access to?"
```

**Expected:** Claude should list tools including:
- `serena_find_symbol`
- `serena_get_symbols_overview`
- `serena_find_referencing_symbols`
- `get_cluster_overview`
- `get_cluster_files`

---

## Troubleshooting

### Issue: "MCP server failed to start"

**For Serena:**
1. Verify uvx is installed: `python -m uv tool list`
2. Check serena-agent is installed: Should show `serena-agent v0.1.4`
3. Try running manually: `uvx --from serena-agent serena-mcp-server --help`

**For Semantic Navigator:**
1. Verify Python is installed: `python --version`
2. Check dependencies: `pip list | grep -E "sentence-transformers|scikit-learn"`
3. Try running manually: `python C:\Gauntlet\CollabBoard\mcp-semantic-navigator\server.py`

### Issue: "Project not found" (Serena)

**Fix:** Make sure you're working in the CollabBoard directory when starting conversations. The `--project-from-cwd` flag tells Serena to look for `.serena/project.yml` in the current directory.

### Issue: "Invalid JSON" in config file

**Fix:** Use a JSON validator like https://jsonlint.com/ to check your config file syntax.

Common mistakes:
```json
// ❌ WRONG: Extra comma before closing brace
{
  "mcpServers": {
    "serena": {...},
  }
}

// ✅ CORRECT: No comma before closing brace
{
  "mcpServers": {
    "serena": {...}
  }
}
```

### Issue: "Command not found: python"

**Windows:** Change `"command": "python"` to `"command": "python.exe"`

**macOS/Linux:** Change to `"command": "python3"`

### Issue: Serena tools not showing up

**Check logs:**
- Windows: `C:\Users\paulk\.serena\logs\`
- macOS: `~/.serena/logs/`
- Linux: `~/.serena/logs/`

Look for error messages in the latest log file.

---

## What Each MCP Server Provides

### Serena Tools (26)

**Navigation:**
- `serena_find_symbol` - Search for functions, classes, hooks
- `serena_find_referencing_symbols` - Find all usages
- `serena_get_symbols_overview` - File structure

**Editing:**
- `serena_replace_symbol_body` - Replace function implementations
- `serena_insert_before_symbol` - Add code before functions
- `serena_insert_after_symbol` - Add code after functions
- `serena_rename_symbol` - Refactor names across codebase

**Files:**
- `serena_read_file` - Read files
- `serena_create_text_file` - Create files
- `serena_find_file` - Find files by pattern

**Memory:**
- `serena_write_memory` - Save project context
- `serena_read_memory` - Retrieve saved context

**And 15 more tools!** See [SERENA_SETUP.md](SERENA_SETUP.md) for complete list.

### Semantic Navigator Tools (2)

**Architecture:**
- `get_cluster_overview` - Get high-level codebase structure
- `get_cluster_files` - List files in a conceptual cluster

---

## Usage Examples

### With Serena:

**"Refactor the useBoard hook to add error handling"**
→ Serena will find the hook, edit just that function, preserve formatting

**"Find all components that use usePresence"**
→ Serena will trace references across the entire codebase

**"Rename boardId to boardIdentifier everywhere"**
→ Serena will refactor safely across all files

### With Semantic Navigator:

**"What's the overall architecture of CollabBoard?"**
→ Navigator will show 11 conceptual areas (UI, Hooks, Services, etc.)

**"Show me all the AI-related files"**
→ Navigator will list files in the AI/Agent cluster

---

## Uninstalling

To remove the MCP servers, simply delete their entries from `claude_desktop_config.json` and restart Claude Code.

---

## Next Steps

Once both MCP servers are working:

1. **Ask Claude to use Serena for precise edits**
   - "Use Serena to update the AI agent"

2. **Ask Claude to use Navigator for understanding**
   - "Give me a semantic overview of the project"

3. **Combine both tools**
   - Navigator shows you the architecture
   - Serena lets you edit specific symbols

---

**Updated:** 2026-02-18
**Serena Version:** 0.1.4
**Semantic Navigator:** Custom MCP Server
**Status:** Ready to install
