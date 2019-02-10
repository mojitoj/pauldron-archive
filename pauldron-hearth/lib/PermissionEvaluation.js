const _ = require("lodash");

function wildCardAndArrayMatcher (grantedScopeValue, requestedScopeValue) { 
    if (grantedScopeValue==="*") 
        return true; 
    else if (Array.isArray(grantedScopeValue)) {
        //todo: this needs a check to make sure there's a cap on the number of cascaded arrays to keep this recursion under control and curb out of memory attacks.
        return Array.isArray(requestedScopeValue) 
            ? requestedScopeValue.every((requestedScopeValueElement) =>
                    grantedScopeValue.some((grantedScopeValueElement)=> 
                        _.isEqualWith(grantedScopeValueElement, requestedScopeValueElement, wildCardAndArrayMatcher)
                    )
              )
            : grantedScopeValue.some((grantedScopeValueElement) => 
                _.isEqualWith(grantedScopeValueElement, requestedScopeValue, wildCardAndArrayMatcher)
              );
    }
    //no else. Otherwise, returns undefined which triggers isEqualWith to fall back to using deepEqual.
}

function evaluateRequestedScopeAgainstGrantedScope(grantedScope, requestedScope) {
    const denied = grantedScope.deny;
    const matched = _.isEqualWith(_.omit(grantedScope, ["deny"]), requestedScope, wildCardAndArrayMatcher);
    return matched 
        ? (denied ? "Deny" : "Permit") 
        : "NotApplicable";
}

function evaluateRequestedScopeAgainstGrantedScopes(grantedScopes, requestedScope) {
    const evaluationResults = grantedScopes.map((grantedScope) => 
        evaluateRequestedScopeAgainstGrantedScope(grantedScope, requestedScope)
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
