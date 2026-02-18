#!/usr/bin/env python3
"""
Quick demo of the semantic navigator
Shows how it analyzes CollabBoard's codebase
"""

import json
import subprocess
import sys

def demo():
    print("=" * 60)
    print("MCP Semantic Navigator - Demo")
    print("=" * 60)
    print()

    # Create test requests
    requests = [
        {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}},
        {"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {
            "name": "get_cluster_overview",
            "arguments": {"path": "."}
        }}
    ]

    # Send requests to server
    input_data = "\n".join(json.dumps(req) for req in requests)

    print("Analyzing CollabBoard codebase...")
    print()

    result = subprocess.run(
        ["python", "server.py"],
        input=input_data,
        capture_output=True,
        text=True,
        cwd="."
    )

    # Parse and display results
    for line in result.stdout.strip().split('\n'):
        try:
            response = json.loads(line)
            if response.get('id') == 2:
                content = response['result']['content'][0]['text']
                print(content)
        except:
            pass

    print()
    print("=" * 60)
    print("Demo complete!")
    print()
    print("To use with Claude Code:")
    print("1. Add this to your MCP settings:")
    print('   "semantic-navigator": {')
    print('     "command": "python",')
    print('     "args": ["mcp-semantic-navigator/server.py"]')
    print('   }')
    print()
    print("2. Ask Claude: 'Give me a semantic overview of this codebase'")
    print("=" * 60)

if __name__ == '__main__':
    demo()
