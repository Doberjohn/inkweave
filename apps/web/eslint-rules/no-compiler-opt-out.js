// no-compiler-opt-out (#937): React Compiler (vite.config.ts) skips code without a word when
// that code opts out of its checks. This rule fails on each way in:
// - a comment that turns off a react-hooks rule: an eslint-disable comment, or an `eslint`
//   config comment that sets one to off or to warn, which lint lets through. The compiler skips
//   a component under an exhaustive-deps or rules-of-hooks suppression, and the other
//   react-hooks rules report what the compiler itself stops on;
// - a 'use no memo' or 'use no forget' directive, which opts its function or module out.
// eslint-plugin-react-compiler caught both until #937 dropped it for eslint-plugin-react-hooks,
// whose rules catch neither.

const REACT_HOOKS_RULE = /^react-hooks\//;
const DISABLE = /^\s*eslint-disable(?:-next-line|-line)?(?:\s+([\s\S]*))?$/;
const CONFIG = /^\s*eslint\s+([\s\S]*)$/;
/** A rule an `eslint` config comment sets to off or warn: `rule: off`, `rule: 1`, `rule: ["warn", …]`. */
const SET_LOWER = /([\w@/-]+)\s*:\s*\[?\s*["']?(?:off|warn|0|1)\b/g;
const OPT_OUT_DIRECTIVES = new Set(['use no memo', 'use no forget']);

/** The rules a directive comment turns off. ESLint ends the directive at a ` -- why`. */
function rulesTurnedOff(comment) {
  const directive = comment.value.split(/\s-{2,}\s/)[0];
  const disable = DISABLE.exec(directive);
  if (disable) return (disable[1] ?? '').split(',').map((rule) => rule.trim());
  const config = CONFIG.exec(directive);
  if (config) return [...config[1].matchAll(SET_LOWER)].map((match) => match[1]);
  return [];
}

export const noCompilerOptOut = {
  meta: {
    type: 'problem',
    docs: {description: 'Disallow turning off react-hooks rules or opting code out of React Compiler'},
    schema: [],
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const rules = rulesTurnedOff(comment).filter((rule) => REACT_HOOKS_RULE.test(rule));
          if (rules.length === 0) continue;
          context.report({
            loc: comment.loc,
            message: `Don't turn off ${rules.join(', ')}. React Compiler only works on code that follows the rules of React: with a check off, it may skip the component without a word, or behave incorrectly. Fix the code instead.`,
          });
        }
      },
      ExpressionStatement(node) {
        if (!OPT_OUT_DIRECTIVES.has(node.directive)) return;
        context.report({
          node,
          message: `'${node.directive}' opts this code out of React Compiler. Remove it, and fix whatever the react-hooks rules then report.`,
        });
      },
    };
  },
};
