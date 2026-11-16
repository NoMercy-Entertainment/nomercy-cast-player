// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import { ESLintUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

// Owner 2026-10-13 asked to wrap `type PanelQuery<T> = { data: ...; isPending: ...; isError: ... }`
// into a formatted object, and preferred `return {\n ...labels,\n ...words(...),\n roles: ... }`
// over the one-line object. An object type or object literal with this many entries or more puts
// every entry on its own line, even when it fits on one.

const minEntries = 3;
function indentUnitOf(source: TSESLint.SourceCode): string {
  return /^\t/m.test(source.text) ? '\t' : '  ';
}

type Braced = TSESTree.ObjectExpression | TSESTree.TSTypeLiteral;
type Entry = TSESTree.ObjectLiteralElement | TSESTree.TypeElement;

function lineIndent(source: TSESLint.SourceCode, line: number): string {
  return /^\s*/.exec(source.lines[line - 1] ?? '')?.[0] ?? '';
}

function entryText(source: TSESLint.SourceCode, entry: Entry): string {
  return source.getText(entry).replace(/[;,]$/, '');
}

function isOneEntryPerLine(node: Braced, entries: Entry[]): boolean {
  const lines = entries.map((entry) => entry.loc.start.line);

  return (
    node.loc.start.line < lines[0]! &&
    new Set(lines).size === lines.length &&
      node.loc.end.line > entries.at(-1)!.loc.end.line
  );
}

export const membersPerLine = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    schema: [],
    messages: {
      perLine: `An object or object type with ${minEntries} or more entries puts each entry on its own line.`,
    },
  },
  defaultOptions: [],
  create(context) {
    const source = context.sourceCode;

    // Object types end each line with a semicolon; object literals keep a trailing comma.
    function check(node: Braced, entries: Entry[], separator: string): void {
      if (entries.length < minEntries || isOneEntryPerLine(node, entries)) return;

      const indent = lineIndent(source, node.loc.start.line);
      const lines = entries
        .map((entry) => indent + indentUnitOf(source) + entryText(source, entry) + separator)
        .join('\n');

      context.report({
        node,
        messageId: 'perLine',
        fix: (fixer) => fixer.replaceText(node, `{\n${lines}\n${indent}}`),
      });
    }

    return {
      TSTypeLiteral: (literal) => check(literal, literal.members, ';'),
      ObjectExpression: (object) => check(object, object.properties, ','),
    };
  },
});
