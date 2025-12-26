#!/usr/bin/env bash

set -e  # exit immediately if a command fails


MODE=$1

if [ "$MODE" = "base" ]; then
    echo "Running base (regression) tests..."
    pnpm run test:spec -- --exclude=tests/new/*.test.ts
elif [ "$MODE" = "new" ]; then
    echo "Running new tests for non-enumerable properties..."
    pnpm run test:spec tests/new/nonEnumerableProps.test.ts
else
    echo "Usage: ./test.sh [base|new]"
    exit 1
fi
