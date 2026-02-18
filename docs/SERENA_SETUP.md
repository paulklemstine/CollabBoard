# Serena - Semantic Code Agent Setup

**Status**: ✅ Installed and Configured for CollabBoard

Serena is a powerful coding agent toolkit that provides semantic code navigation and editing capabilities using Language Server Protocol (LSP). It gives Claude Code "IDE-like tools" for understanding and manipulating code.

---

## What is Serena?

Serena transforms me (Claude) into an advanced coding agent with:
- **Semantic code understanding** - Navigate by symbols, not files
- **26 powerful tools** - Find, edit, refactor code intelligently
- **30+ language support** - TypeScript, Python, Rust, Java, Go, etc.
- **LSP integration** - Real IDE-like code intelligence

**Key Advantage**: Instead of reading entire files, I can query specific symbols, find references, and make precise edits.

---

## Installation Complete ✅

### What Was Installed

1. **uv package manager** - Python package installer
2. **Serena agent** - MCP server with 26 tools
3. **CollabBoard project** - Indexed 90 TypeScript files

### Project Structure Created

```
CollabBoard/
├── .serena/
│   ├── project.yml        # Serena project configuration
│   ├── cache/             # LSP symbol cache (90 files indexed)
│   ├── memories/          # Project-specific memories
│   └── .gitignore
```

---

## Available Tools (26)

Serena provides 26 tools organized by category:

### 📖 Reading & Navigation (7 tools)
1. **`read_file`** - Read file contents
2. **`list_dir`** - List directory contents
3. **`find_file`** - Find files by path pattern
4. **`get_symbols_overview`** - Get top-level symbols in a file
5. **`find_symbol`** - Search for symbols globally or locally
6. **`find_referencing_symbols`** - Find all references to a symbol
7. **`search_for_pattern`** - Pattern search across codebase

### ✏️ Editing & Refactoring (7 tools)
8. **`create_text_file`** - Create/overwrite files
9. **`replace_content`** - Regex-based content replacement
10. **`replace_symbol_body`** - Replace entire symbol definition
11. **`insert_after_symbol`** - Insert code after a symbol
12. **`insert_before_symbol`** - Insert code before a symbol
13. **`rename_symbol`** - Rename symbol throughout codebase
14. **`execute_shell_command`** - Run shell commands

### 🧠 Memory & Context (6 tools)
15. **`write_memory`** - Save project-specific memories
16. **`read_memory`** - Read saved memories
17. **`list_memories`** - List all memories
18. **`delete_memory`** - Delete a memory
19. **`edit_memory`** - Edit existing memory
20. **`check_onboarding_performed`** - Check if project onboarded

### 🎯 Project Management (6 tools)
21. **`activate_project`** - Switch between projects
22. **`get_current_config`** - View current configuration
23. **`switch_modes`** - Change operation modes
24. **`onboarding`** - Identify project structure and tasks
25. **`prepare_for_new_conversation`** - Context for new conversations
26. **`initial_instructions`** - Usage instructions

---

## Configuration for Claude Code

### Step 1: Locate Config File

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

### Step 2: Add Serena MCP Server

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "serena": {
      "command": "C:\\Users\\paulk\\.local\\bin\\serena-mcp-server.exe",
      "args": ["--project-from-cwd"],
      "env": {
        "PATH": "C:\\Users\\paulk\\.local\\bin;${PATH}"
      }
    }
  }
}
```

**Note**: Adjust the path based on your system! The `uv` install location may vary.

**For Unix/Mac**, use:
```json
{
  "mcpServers": {
    "serena": {
      "command": "/Users/yourname/.local/bin/serena-mcp-server",
      "args": ["--project-from-cwd"]
    }
  }
}
```

### Step 3: Restart Claude Code

After saving the configuration, restart Claude Code for changes to take effect.

---

## How to Use Serena Tools

Once configured, you can ask me to use Serena's semantic capabilities!

### Example Commands

#### 🔍 Find Symbols
```
"Find all functions related to authentication"
"Show me the definition of the useBoard hook"
"Find the StickyNote component and its methods"
```

I'll use `find_symbol` with semantic search instead of reading entire files!

#### 🔗 Find References
```
"Where is the addStickyNote function called?"
"Find all components that use the useAuth hook"
"Show me everywhere the BoardObject type is referenced"
```

I'll use `find_referencing_symbols` to trace usage across the codebase!

#### ✏️ Precise Editing
```
"Update the useBoard hook to add error handling"
"Add a new method to the StickyNote component"
"Rename the boardId parameter to boardIdentifier everywhere"
```

I'll use symbolic editing tools like `replace_symbol_body`, `insert_after_symbol`, and `rename_symbol`!

#### 🧠 Project Understanding
```
"Give me an overview of the authentication system"
"What are the main components in the Board folder?"
"Show me the architecture of the hooks layer"
```

I'll use `get_symbols_overview` and `find_symbol` to build a semantic map!

---

## How Serena Enhances My Capabilities

### Before Serena (File-Based)
```
Me: "Let me read src/hooks/useBoard.ts..."
[Reads entire 500-line file]
[Reads 5 more related files]
[2000+ tokens used]
```

### With Serena (Symbol-Based)
```
Me: "Let me find the useBoard hook..."
[Uses find_symbol to locate specific functions]
[Only reads relevant symbol bodies]
[200 tokens used, 90% savings!]
```

### Key Advantages

✅ **Token Efficient** - Only read what's needed
✅ **Precise Editing** - Edit symbols, not files
✅ **Refactoring Safe** - Rename across entire codebase
✅ **Semantic Understanding** - Navigate by meaning
✅ **LSP-Powered** - Real IDE-like intelligence

---

## Modes of Operation

Serena operates in two modes (both active):

### 1. **Editing Mode**
- Can modify code with semantic tools
- Preserves code style and patterns
- Uses symbolic editing when possible
- Falls back to regex for line-level edits

### 2. **Interactive Mode**
- Engages with you throughout tasks
- Asks for clarification when needed
- Breaks down complex tasks
- Provides progress updates

---

## Serena Dashboard

Serena includes a web dashboard for monitoring:
- **URL**: `http://127.0.0.1:24282/dashboard/index.html`
- **Features**:
  - View active tools
  - Monitor language server status
  - Check symbol cache
  - See tool usage statistics

The dashboard starts automatically when the MCP server launches.

---

## Project-Specific Memories

Serena can store project-specific knowledge:

```
"Remember that the AI agent uses Claude Haiku 4.5"
"Save a note that tests use Vitest + React Testing Library"
"What do you remember about the authentication system?"
```

Memories are stored in `.serena/memories/` and persist across conversations!

---

## Technical Details

### Language Server
- **Protocol**: LSP (Language Server Protocol)
- **Language**: TypeScript (configured for CollabBoard)
- **Cache**: 90 files indexed
- **Location**: `.serena/cache/`

### Indexed Files
- All TypeScript/TSX files in `src/`
- All TypeScript files in `functions/src/`
- Respects `.gitignore` patterns
- Auto-excludes `node_modules`, `dist`, `build`

### Symbol Types Recognized
- Functions
- Classes
- Interfaces
- Types
- Variables
- Imports/Exports
- React Components
- Hooks

---

## Use Cases for CollabBoard

### 1. **Refactoring Hooks**
```
"Rename useSmoothedPosition to useInterpolatedPosition everywhere"
```
Serena will find all references and update them safely.

### 2. **Adding Features**
```
"Add a new tool called rotateMultiple to the AI agent"
```
Serena will find the right location in `functions/src/index.ts` and insert it properly.

### 3. **Understanding Dependencies**
```
"Show me all components that depend on useBoard"
```
Serena will trace references and show the dependency graph.

### 4. **Code Review**
```
"Find all TODO comments in the hooks folder"
```
Serena can search patterns and provide context.

---

## Troubleshooting

### "Serena command not found"
- Add to PATH: `$env:PATH = "C:\Users\paulk\.local\bin;$env:PATH"` (Windows)
- Or use full path in MCP config

### "Project not found"
- Ensure you're in the CollabBoard directory
- Use `--project-from-cwd` flag
- Check `.serena/project.yml` exists

### "Language server not starting"
- Check logs in `C:\Users\paulk\.serena\logs\`
- Verify TypeScript is installed
- Try `serena project index` to re-index

### "Tool execution timeout"
- Increase timeout: `--tool-timeout 60`
- Check LSP server health: `serena project health-check`

---

## Advanced Configuration

### Custom Ignore Patterns

Edit `.serena/project.yml`:
```yaml
ignore_patterns:
  - "**/*.test.ts"
  - "**/dist/**"
  - "**/__pycache__/**"
```

### Add More Languages

```bash
serena project create --language python --language rust
```

### Configure Modes

Add to config to customize behavior:
```bash
serena-mcp-server --mode interactive --mode editing --mode debugging
```

---

## Comparison with Semantic Navigator

| Feature | Semantic Navigator | Serena |
|---------|-------------------|--------|
| **Purpose** | High-level architecture view | Precise code manipulation |
| **Approach** | Pattern matching | LSP symbol analysis |
| **Tools** | 2 (index, overview) | 26 (read, edit, refactor) |
| **Use Case** | Understanding codebase | Editing codebase |
| **Integration** | Complements Serena | Complements Navigator |

**Use Both!**
- **Semantic Navigator**: "What's the architecture?"
- **Serena**: "Edit the authentication system"

---

## Resources

- **Documentation**: https://oraios.github.io/serena/
- **GitHub**: https://github.com/oraios/serena
- **Logs**: `C:\Users\paulk\.serena\logs\`
- **Config**: `C:\Users\paulk\.serena\serena_config.yml`
- **Project**: `C:\Gauntlet\CollabBoard\.serena\project.yml`

---

## What's Next?

Now that Serena is set up, try asking me:

1. **"Use Serena to find all React hooks in the codebase"**
2. **"Show me the structure of the useBoard hook"**
3. **"Find everywhere the BoardObject type is used"**
4. **"Add a new function to the boardService"**

I'll use Serena's 26 tools to give you precise, semantic answers instead of reading entire files!

---

**Setup Date**: 2026-02-18
**Version**: Serena 0.1.4
**Status**: ✅ Ready to Use
**Indexed Files**: 90 TypeScript files
**Tools Available**: 26 semantic coding tools

---

## Quick Reference

### Find Code
```bash
serena tools call find_symbol '{"pattern": "useBoard", "include_body": false}'
```

### Find References
```bash
serena tools call find_referencing_symbols '{"name_path": "useBoard", "relative_path": "src/hooks/useBoard.ts"}'
```

### Symbol Overview
```bash
serena tools call get_symbols_overview '{"relative_path": "src/hooks/useBoard.ts"}'
```

**Or just ask me in chat - I'll use these tools automatically!** 🚀
