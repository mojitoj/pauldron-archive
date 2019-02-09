const _ = require("lodash");

function evaluateRequestedScopeAgainstGrantedScope(grantedScope, requesterScope) {
    return _.isEqual(grantedScope, requesterScope) ? "Permit" : "NotApplicable";
}

function evaluateRequestedScopeAgainstGrantedScopes(grantedScopes, requestedScope) {
    const evaluationResults = grantedScopes.map(
        (grantedScope) => evaluateRequestedScopeAgainstGrantedScope(grantedScope, requestedScope)
    );
    
    return !evaluationResults.some((result)=>(result === "Deny")) 
            && evaluationResults.some((result)=>(result === "Permit"));
}

function evaluateRequestedScopesAgainstGrantedScopes(grantedScopes, requestedScopes) {
    return requestedScopes.every( 
        (requestedScope)=>(evaluateRequestedScopeAgainstGrantedScopes(grantedScopes, requestedScope))
    ); 
}

module.exports = {
    evaluateRequestedScopesAgainstGrantedScopes
}
