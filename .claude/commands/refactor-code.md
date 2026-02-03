---
allowed-tools: Read, Edit, Write, Glob, Grep, Task
description: Scan codebase for refactoring opportunities and apply them
argument-hint: [optional: specific area or focus]
---

# Refactor Code - Comprehensive Codebase Scan

Thoroughly scan the codebase for refactoring opportunities and apply them.

Focus area (optional): $ARGUMENTS

## Refactoring Checklist

### 1. Code Duplication
- Look for repeated code blocks across files
- Extract shared logic into reusable functions/hooks/components
- Create shared utilities for common operations
- Consolidate similar type definitions

### 2. Component/Module Structure
- Identify components that are too large (>200 lines)
- Extract sub-components where logical
- Check for proper separation of concerns
- Ensure consistent file organization

### 3. Dead Code
- Find unused imports
- Find unused functions/variables
- Find unused exports
- Remove commented-out code blocks

### 4. Type Safety
- Look for `any` types that can be narrowed
- Add missing type annotations
- Consolidate duplicate type definitions
- Ensure consistent type naming

### 5. Constants & Magic Values
- Extract magic numbers/strings to named constants
- Consolidate repeated values into shared constants
- Check for hardcoded values that should be configurable

### 6. Naming & Readability
- Inconsistent naming conventions
- Unclear variable/function names
- Missing or outdated comments on complex logic

### 7. Performance Opportunities
- Missing memoization (useMemo, useCallback, React.memo)
- Unnecessary re-renders
- Inefficient data transformations

### 8. Import Organization
- Consolidate imports from same module
- Use barrel exports where appropriate
- Check for circular dependencies

## Process

1. **Scan** - Use Glob and Grep to find patterns across the codebase
2. **Analyze** - Identify the most impactful refactoring opportunities
3. **Prioritize** - Focus on changes that reduce duplication or improve maintainability
4. **Apply** - Make the refactoring changes
5. **Verify** - Run tests and lint to ensure nothing broke
6. **Report** - Summarize what was refactored and why

## Constraints

- Do NOT add new features
- Do NOT change public APIs unless necessary
- Ensure all tests pass after changes
- Keep changes focused and reviewable
