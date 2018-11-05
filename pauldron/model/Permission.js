

function validatePermission(permission) {
    return (permission.resource_set_id
        && permission.scopes
        && permission.scopes instanceof Array);
}

function validatePermissionArray(object){
    if (object instanceof Array && object.length > 0) {
        return object.reduce (
            (previousValue, currentValue, currentIndex) => (previousValue && validatePermission(currentValue)),
            true
        );
    }
    return false;
}

function validate(object){
    return (object instanceof Array) 
        ? validatePermissionArray(object)
        : validatePermission(object);
}

function isExpired(permission) {

}

module.exports = {
    validate
};
