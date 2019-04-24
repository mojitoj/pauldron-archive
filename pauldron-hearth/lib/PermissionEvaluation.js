const _ = require("lodash");

function subsumeMatcher (subsumer, subsumee) { 
    if (subsumer==="*") 
        return true; 
    else if (Array.isArray(subsumer)) {
        //todo: this needs a check to make sure there's a cap on the number of cascaded arrays to keep this recursion under control and curb out of memory attacks.
        return Array.isArray(subsumee) 
            ? subsumee.every((subsumeeElement) =>
                subsumer.some((subsumerElement) => 
                        _.isEqualWith(subsumerElement, subsumeeElement, subsumeMatcher)
                )
            )
            : subsumer.some((subsumerElement) => 
                _.isEqualWith(subsumerElement, subsumee, subsumeMatcher)
            );
    }
    //no else. Otherwise, returns undefined which triggers isEqualWith to fall back to using deepEqual.
}

function intersectMatcher (setA, setB) { 
    if (setA==="*") {
        return !_.isEmpty(setB); 
    } else if (setB==="*") {
        return !_.isEmpty(setA); 
    } else if (Array.isArray(setA)) {
        return Array.isArray(setB) 
            ? setB.some((setBElement) =>
                setA.some((setAElement) => 
                        _.isEqualWith(setAElement, setBElement, intersectMatcher)
                )
            )
            : setA.some((setAElement) => 
                _.isEqualWith(setAElement, setB, intersectMatcher)
            );
    } else if (Array.isArray(setB)) {
        return setB.some((setBElement) => 
                _.isEqualWith(setBElement, setA, intersectMatcher)
            );
    }
    //no else. Otherwise, returns undefined which triggers isEqualWith to fall back to using deepEqual.
}

function subsumes(subsumer, subsumee) {
    return _.isEqualWith(subsumer, subsumee, subsumeMatcher);
}

function intersects(setA, setB) {
    return _.isEqualWith(setA, setB, intersectMatcher);
}

function evaluateOneRequestedAgainstOneGranted(grantedScope, requestedScope) {
    return (grantedScope.deny) 
        ? oneRequestedAgainstOneDenied(grantedScope, requestedScope)
        : oneRequestedAgainstOneGranted(grantedScope, requestedScope);
}

function oneRequestedAgainstOneGranted(grantedScope, requestedScope) {
    return (subsumes(grantedScope, requestedScope)) 
        ? "Permit"
        : "NotApplicable";
}

function oneRequestedAgainstOneDenied(grantedScope, requestedScope) {
    return intersects(_.omit(grantedScope, ["deny"]), requestedScope) 
        ? "Deny"
        : "NotApplicable";
}

function evaluateOneRequestedAgainstManyGranted(grantedScopes, requestedScope) {
    const evaluationResults = grantedScopes.map((grantedScope) => 
        evaluateOneRequestedAgainstOneGranted(grantedScope, requestedScope)
    );    
    return !evaluationResults.some((result)=>(result === "Deny")) 
            && evaluationResults.some((result)=>(result === "Permit"));
}

function evaluateRequestedScopesAgainstGrantedScopes(grantedScopes, requestedScopes) {
    return requestedScopes.every( 
        (requestedScope)=>(evaluateOneRequestedAgainstManyGranted(grantedScopes, requestedScope))
    ); 
}

module.exports = {
    evaluateRequestedScopesAgainstGrantedScopes
}
