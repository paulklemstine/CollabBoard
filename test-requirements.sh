#!/usr/bin/env bash
# =============================================================================
# CollabBoard — G4 Week 1 Requirements Test Runner
#
# Launches a live browser and tests every requirement from the project spec:
#   - MVP Requirements (auth, pan/zoom, sticky notes, shapes, sync, presence)
#   - Board Features (connectors, text, frames, transforms, selection, operations)
#   - Real-Time Collaboration (2-user sync, cursors, persistence, resilience)
#   - Performance Targets (object capacity, FPS, latency)
#   - AI Board Agent (6+ command types, SWOT, grid layout, color change)
#   - Chat
#   - Deployment (production URL accessibility)
#
# Usage:
#   ./test-requirements.sh              # headless (CI-friendly)
#   ./test-requirements.sh --headed     # visible browser
#   ./test-requirements.sh --prod       # test against production URL
#   ./test-requirements.sh --headed --prod  # visible browser + production
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")"

HEADED=0
TEST_URL=""

for arg in "$@"; do
  case "$arg" in
    --headed) HEADED=1 ;;
    --prod)   TEST_URL="https://collabboard-8c0d0.web.app" ;;
    *)        echo "Unknown argument: $arg"; echo "Usage: $0 [--headed] [--prod]"; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# 1. Ensure dependencies
# ---------------------------------------------------------------------------
echo "============================================"
echo "  CollabBoard Requirements Test Suite"
echo "============================================"
echo ""

# Check if @playwright/test is available
if ! npx playwright --version &>/dev/null; then
  echo "[1/3] Installing @playwright/test..."
  npm install --save-dev @playwright/test
else
  echo "[1/3] @playwright/test is available ($(npx playwright --version))"
fi

# Install browsers if needed
echo "[2/3] Ensuring Playwright browsers are installed..."
npx playwright install chromium 2>/dev/null || npx playwright install

echo "[3/3] Setup complete."
echo ""

# ---------------------------------------------------------------------------
# 2. Run the tests
# ---------------------------------------------------------------------------
echo "============================================"
echo "  Running requirement tests..."
if [ "$HEADED" -eq 1 ]; then
  echo "  Mode: HEADED (visible browser)"
else
  echo "  Mode: HEADLESS"
fi
if [ -n "$TEST_URL" ]; then
  echo "  Target: $TEST_URL"
else
  echo "  Target: http://localhost:5173 (dev server auto-started)"
fi
echo "============================================"
echo ""

export HEADED="$HEADED"
if [ -n "$TEST_URL" ]; then
  export TEST_URL="$TEST_URL"
fi

# Run playwright tests
npx playwright test tests/requirements.spec.ts \
  --reporter=list \
  --config=playwright.config.ts

EXIT_CODE=$?

echo ""
echo "============================================"
if [ $EXIT_CODE -eq 0 ]; then
  echo "  ALL REQUIREMENTS PASSED"
else
  echo "  SOME REQUIREMENTS FAILED (exit code: $EXIT_CODE)"
  echo ""
  echo "  View detailed report:"
  echo "    npx playwright show-report"
fi
echo "============================================"

exit $EXIT_CODE
