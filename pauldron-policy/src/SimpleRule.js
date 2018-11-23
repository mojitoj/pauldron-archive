const esprima = require("esprima");

const permittedExpressionTypes = [
    "ExpressionStatement",
    "LogicalExpression",
    "Literal",
    "MemberExpression",
    "BinaryExpression",
    "CallExpression",
    "Identifier",
    "ArrowFunctionExpression",
    "UnaryExpression"
];

const permittedMemberFunctionCalls = [
    "filter",
    "map",
    "reduce",
    "hasOwnProperty"
];

const permittedUnaryFunctionCalls = [
    "!"
];

function validateSyntaxNode( node) {
    if (! node.type)
        return;
    if (!permittedExpressionTypes.includes(node.type)) {
        throw {
            error: "invalid_policy",
            message: `${node.type}s are not allowed in 'condition'.`
        };
    } else if (node.type === "CallExpression") {
        if (!permittedMemberFunctionCalls.includes(node.callee.property.name))
            throw {
                error: "invalid_policy",
                message: `Calling ${node.callee.property.name} is not allowed in 'condition'.`
            };
    } else if (node.type === "UnaryExpression") {
        if (!permittedUnaryFunctionCalls.includes(node.operator))
            throw {
                error: "invalid_policy",
                message: `Calling ${node.operator} is not allowed in 'condition'.`
            };
    }
}

function checkSyntaxTreeNodeTypes(node) {
    if (node instanceof Array) {
        node.forEach(element => {
            checkSyntaxTreeNodeTypes(element);
        });
    } else if (node instanceof Object) {
        validateSyntaxNode(node);
        Object.keys(node).forEach((key) => {
            if (node[key] &&
                (node[key] instanceof Object || (node[key]) instanceof Array)) {
                checkSyntaxTreeNodeTypes(node[key]);
            }
        });
    }
}

function validateCondition(conditionString) {
    try {
        const parseTree = esprima.parse(conditionString);
        if (!parseTree.body || parseTree.body.length !== 1 ) {
            throw {
                error: "invalid_policy",
                message: "'condition' must be exactly one non-empty Boolean expression."
            };
        } else {
            checkSyntaxTreeNodeTypes(parseTree.body);
        }
    } catch (e) {
        throw {
            error: "invalid_policy",
            message: `"Invalid 'condition': ${e.message}`
        };
    }
}

function validate(rule) {
    if (!rule.matchAnyOf) {
        throw {
            error: "invalid_policy",
            message: "Must have 'matchAnyOf'."
        };
    } else if (!rule.decision) {
        throw {
            error: "invalid_policy",
            message: "Must have 'decision'."
        };
    } else if (rule.condition || rule.condition === "") {
        validateCondition(rule.condition);
    }
}

module.exports = {
    validate
}
