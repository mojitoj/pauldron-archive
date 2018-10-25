const _ = require("lodash");
const redisClient = require("./redis-client");
const hash = require("object-hash");

const PERMISSIONS_HASH = "pauldron-permissions";
const RPTS_HASH = "pauldron-rpts";
const POLICIES_HASH = "pauldron-policies";


async function getAllObjects(hashName, user) {
    const usersObjectHashName = `${hashName}/${hash(user)}`;
    const rawObjects = await redisClient.hgetall(usersObjectHashName) || {};
    const objects = _.mapValues(rawObjects, (value) => (JSON.parse(value)));
    return objects;
}

async function getObject(hashName, user, objectId) {
    const usersObjectHashName = `${hashName}/${hash(user)}`;
    const rawObject = await redisClient.hget(usersObjectHashName, objectId);
    return rawObject ? JSON.parse(rawObject) : rawObject;
}

//todo: add automatic expiration as another parameter
async function addObject(hashName, user, objectId, object) {
    const usersObjectHashName = `${hashName}/${hash(user)}`;
    await redisClient.hset(usersObjectHashName, objectId, JSON.stringify(object));
}

async function deleteObject(hashName, user, objectId) {
    const usersObjectHashName = `${hashName}/${hash(user)}`;
    await redisClient.hdel(usersObjectHashName, objectId);
}

async function getAllPermissions(user) {
    return getAllObjects(PERMISSIONS_HASH, user);
}

async function getPermission(user, permissionId) {
    return getObject(PERMISSIONS_HASH, user, permissionId);
}

async function addPermission(user, permissionId, permission) {
    await addObject(PERMISSIONS_HASH, user, permissionId, permission)
}

async function deletePermission(user, permissionId) {
    await deleteObject(PERMISSIONS_HASH, user, permissionId);
}

async function getAllRPTs(user) {
    return getAllObjects(RPTS_HASH, user);
}

async function getRPT(user, permissionId) {
    return getObject(RPTS_HASH, user, permissionId);
}

async function addRPT(user, permissionId, permission) {
    await addObject(RPTS_HASH, user, permissionId, permission)
}

async function deleteRPT(user, permissionId) {
    await deleteObject(RPTS_HASH, user, permissionId);
}

async function getAllPolicies(user) {
    return getAllObjects(POLICIES_HASH, user);;
}

async function getPolicy(user, policyId) {
    return getObject(POLICIES_HASH, user, policyId);
}

async function addPolicy(user, policyId, policy) {
    await addObject(POLICIES_HASH, user, policyId, policy);
}

async function deletePolicy(user, policyId) {
    await deleteObject(POLICIES_HASH, user, policyId);
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
