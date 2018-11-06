const _ = require("lodash");
const redisClient = require("./redis-client");
const hash = require("object-hash");

const PERMISSIONS_HASH = "pauldron-permissions";
const RPTS_HASH = "pauldron-rpts";
const POLICIES_HASH = "pauldron-policies";

async function getAllObjects(hashName, user) {
    const keyPattern = `${hashName}/${hash(user)}/*`;
    const keys = await redisClient.keys(keyPattern) || {};

    const rawObjectsPromises = keys.map( (keyName) => redisClient.get(keyName));
    const rawObjects = await Promise.all(rawObjectsPromises);

    const userFacingKeys = keys.map( (key) => {
        const parts = key.split("/");
        return parts[parts.length - 1] || "";
    });

    const rawObjectsObject = _.zipObject(userFacingKeys, rawObjects);
    const objects = _.mapValues(rawObjectsObject, (value) => (JSON.parse(value)));
    return objects;
}

async function getObject(hashName, user, objectId) {
    const keyname = `${hashName}/${hash(user)}/${objectId}`;
    const rawObject = await redisClient.get(keyname);
    return rawObject ? JSON.parse(rawObject) : rawObject;
}

async function addObject(hashName, user, objectId, object, ttlInMs) {
    const keyname = `${hashName}/${hash(user)}/${objectId}`;
    if (ttlInMs > 0) {
        return await redisClient.set(keyname, JSON.stringify(object), "px", ttlInMs);
    } else {
        return await redisClient.set(keyname, JSON.stringify(object));
    }
}

async function deleteObject(hashName, user, objectId) {
    const keyname = `${hashName}/${hash(user)}/${objectId}`;
    return await redisClient.del(keyname);
}

async function getAllPermissions(user) {
    return getAllObjects(PERMISSIONS_HASH, user);
}

async function getPermission(user, permissionId) {
    return getObject(PERMISSIONS_HASH, user, permissionId);
}

const TICKET_TTL  = parseInt(process.env.PERMISSION_TICKET_TTL) || 20;
async function addPermission(user, permissionId, permission) {
    return await addObject(PERMISSIONS_HASH, user, permissionId, permission, TICKET_TTL * 1000);
}

async function deletePermission(user, permissionId) {
    return await deleteObject(PERMISSIONS_HASH, user, permissionId);
}

async function getAllRPTs(user) {
    return getAllObjects(RPTS_HASH, user);
}

async function getRPT(user, permissionId) {
    return getObject(RPTS_HASH, user, permissionId);
}

const RPT_TTL  = parseInt(process.env.RPT_TTL) || 20;
async function addRPT(user, permissionId, permission) {
    return await addObject(RPTS_HASH, user, permissionId, permission, RPT_TTL * 1000);
}

async function deleteRPT(user, permissionId) {
    return await deleteObject(RPTS_HASH, user, permissionId);
}

async function getAllPolicies(user) {
    return getAllObjects(POLICIES_HASH, user);;
}

async function getPolicy(user, policyId) {
    return getObject(POLICIES_HASH, user, policyId);
}

async function addPolicy(user, policyId, policy) {
    return await addObject(POLICIES_HASH, user, policyId, policy, -1);
}

async function deletePolicy(user, policyId) {
    return await deleteObject(POLICIES_HASH, user, policyId);
}

const Permissions = {
    list: getAllPermissions,
    get: getPermission,
    add: addPermission,
    del: deletePermission
};

const RPTs = {
    list: getAllRPTs,
    get: getRPT,
    add: addRPT,
    del: deleteRPT
};

const Policies = {
    list: getAllPolicies,
    get: getPolicy,
    add: addPolicy,
    del: deletePolicy
};

async function flush() {
    await redisClient.flushdb();
}

module.exports = {
    Permissions,
    Policies,
    RPTs,
    flush
}
