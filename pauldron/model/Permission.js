

function validatePermission(permission) {
    return (permission.resource_set_id
        && permission.scopes
        && permission.scopes instanceof Array);
}

function validatePermissionArray(permissions){
    if (permissions instanceof Array && permissions.length > 0) {
        return permissions.every (
            (permission) => (validatePermission(permission))
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
