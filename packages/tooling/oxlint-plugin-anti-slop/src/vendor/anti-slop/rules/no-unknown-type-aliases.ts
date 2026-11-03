// Vendored from anti-slop 13909c9 (src/rules/no-unknown-type-aliases.ts). Do not edit. Run pnpm sync:anti-slop instead.
import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

import {
	createTypeAliasEnvironment,
	resolvedTypeMatches,
	type TypeAliasEnvironment,
} from "../shared/type-alias-resolution.ts";

/** Ban named aliases that merely conceal TypeScript's unknown top type. */
export const noUnknownTypeAliasesRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow type aliases whose resolved type is unknown; unknown must remain visible at an allowed boundary.",
		},
		messages: {
			unknownAlias:
				"Type alias `{{alias}}` hides `unknown`. Keep `unknown` explicit at the parsing boundary or on an allowed `cause` field; otherwise use the parsed owner type.",
		},
	},
	createOnce(context) {
		let environment: TypeAliasEnvironment | null = null;

		const resolvesToUnknown = (type: ESTree.TSType): boolean =>
			environment !== null &&
			resolvedTypeMatches(type, environment, (resolved, matches) => {
				if (resolved.type === "TSUnknownKeyword") return true;
				if (resolved.type === "TSParenthesizedType") {
					return matches(resolved.typeAnnotation);
				}
				return resolved.type === "TSUnionType" && resolved.types.some(matches);
			});

		return {
			Program(node) {
				environment = createTypeAliasEnvironment(
					node,
					context.sourceCode.visitorKeys,
				);
			},
			TSTypeAliasDeclaration(node) {
				if (!resolvesToUnknown(node.typeAnnotation)) return;
				context.report({
					node: node.id,
					messageId: "unknownAlias",
					data: { alias: node.id.name },
				});
			},
		};
	},
});
