#!/bin/bash

# Memory Distillation Command
# Usage: ./distill.sh [days] [--dry-run]
# Called by OpenClaw agent when user sends /distill

set -e

DAYS=${1:-7}
DRY_RUN=""

# Parse arguments
for arg in "$@"; do
  case $arg in
    --dry-run|dryrun)
      DRY_RUN="--dry-run"
      ;;
    weekly)
      DAYS=7
      ;;
    all)
      DAYS=365
      ;;
    [0-9]*)
      DAYS=$arg
      ;;
  esac
done

cd "$(dirname "$0")"

echo "🔍 Starting distillation: last $DAYS days${DRY_RUN:+ (DRY RUN)}"
echo

# Step 1: Prepare extraction
node telegram-distill-handler.js $DAYS $DRY_RUN > /tmp/distill-output.txt 2>&1 &
HANDLER_PID=$!

# Wait a moment for handler to write request file
sleep 2

# Step 2: Check if extraction is needed
if grep -q "EXTRACTION_NEEDED" /tmp/distill-output.txt 2>/dev/null; then
  echo "💡 AI extraction required - handler is waiting for insights"
  echo "📄 Request prepared at /tmp/distill-extraction-request.json"
  echo
  echo "⚠️  This script cannot do AI extraction directly."
  echo "    The OpenClaw agent session must:"
  echo
  echo "    1. Read /tmp/distill-extraction-request.json"
  echo "    2. Extract insights using AI (Sonnet recommended)"
  echo "    3. Write results to /tmp/distill-insights.json"
  echo
  echo "    Then the handler will continue automatically."
  echo
  
  # Show the handler is still running
  wait $HANDLER_PID
  EXIT_CODE=$?
  
  # Show results
  if [ $EXIT_CODE -eq 0 ]; then
    echo
    echo "✅ Distillation complete!"
    grep "MESSAGE_FOR_USER:" /tmp/distill-output.txt | sed 's/MESSAGE_FOR_USER://'
  else
    echo
    echo "❌ Distillation failed (exit code: $EXIT_CODE)"
    tail -20 /tmp/distill-output.txt
  fi
  
  exit $EXIT_CODE
else
  # No extraction needed or already complete
  wait $HANDLER_PID
  EXIT_CODE=$?
  
  if [ $EXIT_CODE -eq 0 ]; then
    grep "MESSAGE_FOR_USER:" /tmp/distill-output.txt | sed 's/MESSAGE_FOR_USER://' || cat /tmp/distill-output.txt
  else
    echo "❌ Distillation failed"
    cat /tmp/distill-output.txt
  fi
  
  exit $EXIT_CODE
fi
