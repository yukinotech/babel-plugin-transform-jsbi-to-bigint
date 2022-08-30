const binaryFunctionToExpression = new Map([
  ["equal", "==="],
  ["notEqual", "!=="],
  ["lessThan", "<"],
  ["greaterThanOrEqual", ">="],
  ["greaterThan", ">"],
  ["lessThanOrEqual", "<="],
]);

const binaryWithRoundFunctionToExpression = new Map([
  ["add", "+"],
  ["subtract", "-"],
  ["multiply", "*"],
  ["divide", "/"],
  ["remainder", "%"],
  ["pow", "**"],
]);

const DATA_IDENTIFIER = "JSBD";

const GLOBAL_IDENTIFIER = "BigDecimal";

module.exports = function (babel) {
  const { types: t } = babel;

  const createExpression = (path, name, args) => {
    if (name === "BigDecimal") {
      return createBigDecimalConstructor(path);
    }
    if (binaryFunctionToExpression.has(name)) {
      if (args.length !== 2) {
        throw path.buildCodeFrameError(
          "Binary operators must have exactly two arguments"
        );
      }
      return t.binaryExpression(
        binaryFunctionToExpression.get(name),
        args[0],
        args[1]
      );
    }

    if (binaryWithRoundFunctionToExpression.has(name)) {
      if (args.length === 2) {
        // => 1n + 2n
        return t.binaryExpression(
          binaryWithRoundFunctionToExpression.get(name),
          args[0],
          args[1]
        );
      } else if (args.length === 3) {
        // => BigDecimal.add(1n,2n,roundOption)
        return t.callExpression(
          t.memberExpression(
            t.identifier(GLOBAL_IDENTIFIER),
            t.identifier(name)
          ),
          args
        );
      } else {
        throw path.buildCodeFrameError(
          "Binary operators must have exactly two arguments"
        );
      }
    }

    throw path.buildCodeFrameError(`Unknown JSBD function '${name}'`);
  };

  const createBigDecimalConstructor = (path) => {
    const reDecimal = /^(?:0|[1-9][0-9]*)$/;
    const arg = path.node.arguments[0];
    if (
      t.isNumericLiteral(arg) ||
      t.isBigIntLiteral(arg) ||
      (t.isStringLiteral(arg) && reDecimal.test(arg.value))
    ) {
      return t.decimalLiteral(`${arg.value}`);
    }
    return t.callExpression(t.identifier("BigDecimal"), [arg]);
  };

  const getPropertyName = (path) => {
    const { node } = path;
    if (t.isIdentifier(node)) return node.name;
    if (t.isStringLiteral(node)) return node.value;
    throw path.buildCodeFrameError(
      "Only .BigDecimal or ['BigDecimal'] allowed here."
    );
  };

  const resolveBinding = (_path, name) => {
    const binding = _path.scope.getBinding(name);
    if (binding === undefined) return;
    const path = binding.path;
    if (path.getData(DATA_IDENTIFIER)) return binding;
    const init = path.node.init;
    if (t.isVariableDeclarator(path) && t.isMemberExpression(init)) {
      return resolveBinding(path.get("init"), init.object.name);
    }
    return binding;
  };

  const getJSBDProperty = (path, name) => {
    const binding = resolveBinding(path, name);
    return binding && binding.path.getData(DATA_IDENTIFIER);
  };

  const setJSBDProperty = (path, data) => {
    return path.setData(DATA_IDENTIFIER, data);
  };

  const hasJSBDProperty = (path, name) => {
    return getJSBDProperty(path, name) !== undefined;
  };

  return {
    pre() {
      this.remove = new Set();
    },
    visitor: {
      Program: {
        exit() {
          for (const path of this.remove) {
            path.remove();
          }
        },
      },
      ImportDeclaration(path) {
        const source = path.node.source;
        if (
          t.isStringLiteral(source) &&
          // Match exact "jsbd" or ".../jsbd.mjs" paths.
          (/^jsbd$/i.test(source.value) ||
            /[/\\]jsbd\.mjs$/i.test(source.value))
        ) {
          for (const specifier of path.get("specifiers")) {
            if (t.isImportDefaultSpecifier(specifier)) {
              setJSBDProperty(specifier, "");
            }
          }
          this.remove.add(path);
        }
      },
      VariableDeclarator(path) {
        const init = path.node.init;
        if (t.isMemberExpression(init)) {
          if (hasJSBDProperty(path, init.object.name)) {
            setJSBDProperty(path, getPropertyName(path.get("init.property")));
            this.remove.add(path);
          }
        }
      },
      CallExpression(path) {
        const callee = path.node.callee;
        if (
          t.isMemberExpression(callee) &&
          hasJSBDProperty(path, callee.object.name)
        ) {
          // Handle usage via `JSBD.foo(bar)`.
          path.replaceWith(
            createExpression(
              path,
              getPropertyName(path.get("callee.property")),
              path.node.arguments
            )
          );
        } else {
          // Handle usage via `JSBigDecimal = JSBD.BigDecimal; JSBigDecimal(foo)`.
          const jsbiProp = getJSBDProperty(path, callee.name);
          if (jsbiProp) {
            path.replaceWith(
              createExpression(path, jsbiProp, path.node.arguments)
            );
          }
        }
      },
      BinaryExpression(path) {
        const { operator, left, right } = path.node;
        if (
          operator === "instanceof" &&
          t.isIdentifier(right, { name: "JSBD" })
        ) {
          path.replaceWith(
            t.binaryExpression(
              "===",
              t.unaryExpression("typeof", left),
              t.stringLiteral("bigdecimal")
            )
          );
        }
      },
    },
  };
};
