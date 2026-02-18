#!/usr/bin/env python3
"""
MCP Semantic Navigator Server
Browse code by meaning, not by file structure
Uses 100% free local tools - no API keys needed!
"""

import json
import sys
from pathlib import Path
from typing import Any

def log(message: str):
    """Log to stderr so it doesn't interfere with JSON-RPC"""
    print(f"[semantic-navigator] {message}", file=sys.stderr)

def scan_code_files(repo_path: str, extensions: list[str] = None) -> list[dict]:
    """Scan repository for code files"""
    if extensions is None:
        extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs']

    files = []
    repo = Path(repo_path)

    for ext in extensions:
        for file_path in repo.rglob(f'*{ext}'):
            # Skip node_modules, dist, build, etc.
            if any(part.startswith('.') or part in ['node_modules', 'dist', 'build', '__pycache__']
                   for part in file_path.parts):
                continue

            try:
                content = file_path.read_text(encoding='utf-8', errors='ignore')
                files.append({
                    'path': str(file_path.relative_to(repo)),
                    'full_path': str(file_path),
                    'content': content[:2000],  # First 2k chars for clustering
                    'size': len(content),
                    'extension': ext
                })
            except Exception as e:
                log(f"Skipping {file_path}: {e}")

    return files

def simple_semantic_clustering(files: list[dict], num_clusters: int = 8) -> dict:
    """
    Simple semantic clustering without ML dependencies
    Groups files by directory patterns and naming conventions
    """
    clusters = {}

    for file_info in files:
        path = file_info['path']
        parts = Path(path).parts

        # Simple heuristic clustering based on path patterns
        cluster_key = None

        # Check common patterns
        if 'component' in path.lower() or 'components' in parts:
            cluster_key = 'UI Components'
        elif 'hook' in path.lower() or 'hooks' in parts:
            cluster_key = 'React Hooks'
        elif 'service' in path.lower() or 'services' in parts:
            cluster_key = 'Services & APIs'
        elif 'util' in path.lower() or 'utils' in parts or 'helper' in path.lower():
            cluster_key = 'Utilities & Helpers'
        elif 'type' in path.lower() or 'types' in parts or 'interface' in path.lower():
            cluster_key = 'Type Definitions'
        elif 'test' in path.lower() or path.endswith('.test.ts') or path.endswith('.test.tsx'):
            cluster_key = 'Tests'
        elif 'config' in path.lower() or 'setup' in path.lower():
            cluster_key = 'Configuration'
        elif any(p in parts for p in ['auth', 'login', 'session']):
            cluster_key = 'Authentication'
        elif any(p in parts for p in ['db', 'database', 'model', 'models']):
            cluster_key = 'Database & Models'
        elif any(p in parts for p in ['api', 'route', 'routes', 'endpoint']):
            cluster_key = 'API Routes'
        else:
            # Use first meaningful directory
            for part in parts:
                if part not in ['.', '..', 'src']:
                    cluster_key = part.capitalize()
                    break
            if cluster_key is None:
                cluster_key = 'Other'

        if cluster_key not in clusters:
            clusters[cluster_key] = []
        clusters[cluster_key].append(file_info)

    return clusters

def handle_request(request: dict) -> dict:
    """Handle MCP JSON-RPC request"""
    method = request.get('method')
    params = request.get('params', {})
    request_id = request.get('id')

    try:
        if method == 'initialize':
            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'result': {
                    'protocolVersion': '0.1.0',
                    'capabilities': {
                        'tools': {}
                    },
                    'serverInfo': {
                        'name': 'semantic-navigator',
                        'version': '0.1.0'
                    }
                }
            }

        elif method == 'tools/list':
            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'result': {
                    'tools': [
                        {
                            'name': 'index_repository',
                            'description': 'Create a semantic index of a code repository (100% local, no API keys needed)',
                            'inputSchema': {
                                'type': 'object',
                                'properties': {
                                    'path': {
                                        'type': 'string',
                                        'description': 'Path to the repository to index'
                                    }
                                },
                                'required': ['path']
                            }
                        },
                        {
                            'name': 'get_cluster_overview',
                            'description': 'Get a semantic overview of the codebase architecture',
                            'inputSchema': {
                                'type': 'object',
                                'properties': {
                                    'path': {
                                        'type': 'string',
                                        'description': 'Path to the repository'
                                    }
                                },
                                'required': ['path']
                            }
                        }
                    ]
                }
            }

        elif method == 'tools/call':
            tool_name = params.get('name')
            tool_args = params.get('arguments', {})

            if tool_name == 'index_repository':
                repo_path = tool_args.get('path', '.')
                log(f"Indexing repository at {repo_path}")

                files = scan_code_files(repo_path)
                clusters = simple_semantic_clustering(files)

                result = {
                    'total_files': len(files),
                    'total_clusters': len(clusters),
                    'clusters': {
                        name: {
                            'file_count': len(files_list),
                            'files': [f['path'] for f in files_list[:10]],  # First 10
                            'sample_file': files_list[0]['path'] if files_list else None
                        }
                        for name, files_list in clusters.items()
                    }
                }

                return {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': {
                        'content': [
                            {
                                'type': 'text',
                                'text': json.dumps(result, indent=2)
                            }
                        ]
                    }
                }

            elif tool_name == 'get_cluster_overview':
                repo_path = tool_args.get('path', '.')
                files = scan_code_files(repo_path)
                clusters = simple_semantic_clustering(files)

                # Create a nice overview
                overview = f"# Semantic Code Architecture\n\n"
                overview += f"**Total Files**: {len(files)}\n"
                overview += f"**Conceptual Areas**: {len(clusters)}\n\n"

                for name, files_list in sorted(clusters.items(), key=lambda x: len(x[1]), reverse=True):
                    overview += f"## {name} ({len(files_list)} files)\n"
                    overview += "Files:\n"
                    for f in files_list[:5]:
                        overview += f"- {f['path']}\n"
                    if len(files_list) > 5:
                        overview += f"- ... and {len(files_list) - 5} more\n"
                    overview += "\n"

                return {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': {
                        'content': [
                            {
                                'type': 'text',
                                'text': overview
                            }
                        ]
                    }
                }

        # Unknown method
        return {
            'jsonrpc': '2.0',
            'id': request_id,
            'error': {
                'code': -32601,
                'message': f'Method not found: {method}'
            }
        }

    except Exception as e:
        log(f"Error handling request: {e}")
        return {
            'jsonrpc': '2.0',
            'id': request_id,
            'error': {
                'code': -32603,
                'message': f'Internal error: {str(e)}'
            }
        }

def main():
    """MCP server main loop"""
    log("Semantic Navigator MCP Server starting...")

    # Read JSON-RPC requests from stdin
    for line in sys.stdin:
        try:
            request = json.loads(line)
            response = handle_request(request)
            print(json.dumps(response), flush=True)
        except json.JSONDecodeError:
            log(f"Invalid JSON: {line}")
        except Exception as e:
            log(f"Error: {e}")

if __name__ == '__main__':
    main()
