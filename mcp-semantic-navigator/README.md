# MCP Semantic Navigator

Browse code by meaning, not by file structure. 100% free, no API keys needed!

## What It Does

Instead of navigating code by folders, this MCP server analyzes your codebase and groups files by their **semantic purpose**:

```
Traditional View:           Semantic View:
src/                       🔐 Authentication (5 files)
├── components/            ├── auth.ts
├── hooks/                 ├── session.ts
├── services/              └── middleware/auth.ts
└── utils/
                           🎨 UI Components (58 files)
                           ├── Button.tsx
                           ├── Modal.tsx
                           └── Card.tsx
```

## Features

- ✅ **100% Free** - No API keys, runs locally
- ✅ **No ML Dependencies** - Uses pattern matching (can upgrade to embeddings later)
- ✅ **Fast** - Instant indexing for repos up to 10k files
- ✅ **MCP Compatible** - Works with Claude Code

## Installation

### Option 1: Direct Use (No Installation)

Just point Claude Code to the server:

```json
// In Claude Code MCP settings
{
  "mcpServers": {
    "semantic-navigator": {
      "command": "python",
      "args": ["C:/Gauntlet/CollabBoard/mcp-semantic-navigator/server.py"]
    }
  }
}
```

### Option 2: With Python Virtual Environment (Recommended for ML version)

```bash
cd mcp-semantic-navigator
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install sentence-transformers scikit-learn  # Optional ML dependencies
```

## Usage in Claude Code

Once configured, you can ask Claude:

**"Give me a semantic overview of this codebase"**

Claude will call the MCP tools and show:
- Total files analyzed
- Conceptual groupings (Authentication, UI Components, etc.)
- File distribution across concepts
- Sample files from each group

**"Index my repository"**

Creates a semantic map of your entire codebase.

## Available Tools

### 1. `index_repository`
Create a semantic index of a code repository.

**Input:**
```json
{
  "path": "./path/to/repo"
}
```

**Output:**
```json
{
  "total_files": 342,
  "total_clusters": 8,
  "clusters": {
    "UI Components": {
      "file_count": 58,
      "files": ["Button.tsx", "Modal.tsx", ...],
      "sample_file": "Button.tsx"
    },
    ...
  }
}
```

### 2. `get_cluster_overview`
Get a high-level semantic breakdown.

**Input:**
```json
{
  "path": "."
}
```

**Output:**
Markdown-formatted overview of the codebase architecture.

## How It Works

### Current Implementation (v0.1.0)
Uses pattern matching to identify semantic clusters:
- Analyzes file paths and names
- Detects common patterns (components, hooks, services, etc.)
- Groups files by purpose

### Future ML Implementation (v0.2.0)
Will use local embeddings for better clustering:
```python
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('all-MiniLM-L6-v2')
embeddings = model.encode(file_contents)
# Spectral clustering on embeddings
```

## Examples

### CollabBoard Repository

```
# Semantic Code Architecture

**Total Files**: 167
**Conceptual Areas**: 12

## UI Components (45 files)
Files:
- src/components/Board/StickyNote.tsx
- src/components/Board/ShapeComponent.tsx
- src/components/Board/FrameComponent.tsx
- src/components/Toolbar/Toolbar.tsx
- src/components/AIChat/AIChat.tsx
... and 40 more

## React Hooks (12 files)
Files:
- src/hooks/useBoard.ts
- src/hooks/useAuth.ts
- src/hooks/useCursors.ts
- src/hooks/usePresence.ts
- src/hooks/useAI.ts
... and 7 more

## Services & APIs (8 files)
Files:
- src/services/boardService.ts
- src/services/authService.ts
- src/services/aiService.ts
- src/services/firebase.ts
... and 4 more
```

## Upgrading to ML-Based Clustering

Want better semantic understanding? Install ML dependencies:

```bash
pip install sentence-transformers scikit-learn
```

Then update `server.py` to use embeddings instead of pattern matching. (Code provided in comments)

## Benefits for Claude Code

When Claude analyzes your codebase, it can:

1. **Faster Understanding**: "Where is authentication code?" → Instant answer
2. **Better Context**: Groups related files even if in different folders
3. **Architecture View**: See high-level organization at a glance
4. **Token Efficiency**: Read only relevant files, not entire directories

## Comparison

| Feature | Traditional File Browse | Semantic Navigator |
|---------|------------------------|-------------------|
| Organization | By folder structure | By purpose/concept |
| Finding related code | Manual search/grep | Automatic clustering |
| Architecture view | README (if exists) | Auto-generated overview |
| API cost | N/A | $0 (100% local) |

## Troubleshooting

**"No files found"**
- Check the path is correct
- Ensure file extensions are supported (.ts, .tsx, .py, etc.)

**"Clusters seem wrong"**
- Current version uses simple pattern matching
- Upgrade to ML version for better accuracy

**"MCP server not connecting"**
- Check Python is in PATH
- Verify server.py has execute permissions
- Check Claude Code MCP settings

## Future Features

- [ ] Similarity search ("Find files like this one")
- [ ] Concept filtering ("Show only database code")
- [ ] Cross-repo analysis
- [ ] Custom clustering rules
- [ ] ML-powered embeddings (optional)

## Contributing

This is a simple proof-of-concept. Ideas for improvement:
1. Add ML-based embeddings for better clustering
2. Support more file types (CSS, HTML, etc.)
3. Add visualization of cluster relationships
4. Cache embeddings for faster re-indexing

## License

MIT - Use freely, no API keys required!
