# Setup Guide for MCP Semantic Navigator

## ✅ Prerequisites Complete!
- Python installed
- `sentence-transformers` installed
- `scikit-learn` installed

## Configure in Claude Code

### Step 1: Find Your Claude Code Config File

The configuration file location depends on your OS:

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```
Or navigate to:
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

### Step 2: Add MCP Server Configuration

Open `claude_desktop_config.json` and add this configuration:

```json
{
  "mcpServers": {
    "semantic-navigator": {
      "command": "python",
      "args": ["C:/Gauntlet/CollabBoard/mcp-semantic-navigator/server.py"]
    }
  }
}
```

**Important:** Adjust the path to match where your CollabBoard repository is located!

If you already have other MCP servers configured, add it to the existing `mcpServers` object:

```json
{
  "mcpServers": {
    "existing-server": {
      ...
    },
    "semantic-navigator": {
      "command": "python",
      "args": ["C:/Gauntlet/CollabBoard/mcp-semantic-navigator/server.py"]
    }
  }
}
```

### Step 3: Restart Claude Code

After saving the configuration file, restart Claude Code (or Claude Desktop) for the changes to take effect.

### Step 4: Verify It Works

In Claude Code chat, ask:

```
"Can you give me a semantic overview of this codebase?"
```

Or:

```
"Use the semantic navigator to analyze this repository"
```

You should see output like:

```markdown
# Semantic Code Architecture

**Total Files**: 92
**Conceptual Areas**: 11

## UI Components (40 files)
Files:
- src/components/Board/StickyNote.tsx
- src/components/Board/ShapeComponent.tsx
...

## React Hooks (16 files)
Files:
- src/hooks/useBoard.ts
- src/hooks/useAuth.ts
...
```

## Available Commands

Once configured, you can ask me (Claude) to:

### 1. **Get Architecture Overview**
```
"Show me the semantic architecture of this codebase"
"Give me a conceptual overview of the project"
"What are the main areas of this code?"
```

### 2. **Index Repository**
```
"Index this repository"
"Create a semantic map of the codebase"
"Analyze the code organization"
```

### 3. **Explore Specific Areas**
```
"Show me all authentication-related code"
"What UI components exist?"
"Where are the API services?"
```

## Troubleshooting

### "MCP server not found"
- Check that the path in `claude_desktop_config.json` is correct
- Verify Python is in your PATH: `python --version`
- Restart Claude Code

### "No files found"
- The path needs to point to your repo root
- Check file extensions are supported (.ts, .tsx, .js, etc.)

### "Permission denied"
- Make sure `server.py` has execute permissions
- On Unix/Mac: `chmod +x mcp-semantic-navigator/server.py`

### "Import error: sentence_transformers"
- Run: `pip install sentence-transformers scikit-learn`
- Or use the fallback pattern-matching mode (already works!)

## What You Get

✅ **Instant codebase understanding** - See conceptual architecture in seconds
✅ **Better code navigation** - Find related files by meaning, not location
✅ **Smarter AI assistance** - Claude understands your architecture faster
✅ **Zero API costs** - 100% local, no external services

## Next Steps

Try asking me questions like:
- "Where should I add new authentication code?"
- "What components handle user input?"
- "Show me all database-related files"
- "What's the relationship between these clusters?"

The semantic navigator helps me give you better, more targeted answers!

## Advanced Usage

### Custom File Extensions

Edit `server.py` line ~17 to add more file types:

```python
extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.css', '.html']
```

### Adjust Cluster Count

In `server.py`, change the default number of clusters (line ~47):

```python
def simple_semantic_clustering(files: list[dict], num_clusters: int = 12):  # Increase from 8
```

### Enable ML Clustering

The ML dependencies are already installed! To use actual embeddings instead of pattern matching, uncomment the ML code in `server.py` (comments provide guidance).

## Support

Issues? Check:
1. Python version: `python --version` (needs 3.8+)
2. Dependencies: `pip list | grep sentence`
3. Claude Code logs (Help > Show Logs)
4. Server output in terminal

Happy semantic browsing! 🚀
