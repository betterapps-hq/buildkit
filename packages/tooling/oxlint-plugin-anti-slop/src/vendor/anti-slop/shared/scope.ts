// Vendored from anti-slop 13909c9 (src/shared/scope.ts). Do not edit. Run pnpm sync:anti-slop instead.
import type { ESTree, Scope, SourceCode, Variable } from "@oxlint/plugins";

/** Resolve an identifier to its binding by walking lexical scopes upward. */
export function resolveVariable(
	sourceCode: SourceCode,
	identifier: ESTree.IdentifierReference,
): Variable | null {
	let scope: Scope | null = sourceCode.getScope(identifier);
	while (scope !== null) {
		const variable = scope.set.get(identifier.name);
		if (variable !== undefined) return variable;
		scope = scope.upper;
	}
	return null;
}
