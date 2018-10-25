const redisClient = require("../../lib/redis-client");
const db = require("../../lib/db");

beforeEach(async () => {
    await redisClient.flushdb();
});

afterAll( async () => {
    await redisClient.flushdb();
});

describe("permissions", () => {
    it("returns an empty object if no permission has been registered.", async () => {
        expect.assertions(1);
        const allPermissions = await db.Permissions.list("id");
        expect(allPermissions).toMatchObject({});
    });

    it("adds, reads, and deletes a permission.", async () => {
        expect.assertions(3);
        const testUser = {id: "testUserId"};
        const permission = {user: testUser};
        const id = "testId";
        await db.Permissions.add(testUser, id, permission);
        
        const thePermission = await db.Permissions.get(testUser, "testId");
        expect(thePermission).toMatchObject(permission);
        
        let allPermissions = await db.Permissions.list(testUser);
        expect(allPermissions).toMatchObject({[id]: permission});

        await db.Permissions.del(testUser, "testId");
        
        allPermissions = await db.Permissions.list(testUser);
        expect(allPermissions).toMatchObject({});
    });
});

describe("rpts", () => {
    it("returns an empty object if no permission has been registered.", async () => {
        expect.assertions(1);
        const allPermissions = await db.RPTs.list("id");
        expect(allPermissions).toMatchObject({});
    });

    it("adds, reads, and deletes a permission.", async () => {
        expect.assertions(3);
        const testUser = {id: "testUserId"};
        const permission = {user: testUser};
        const id = "testId";
        await db.RPTs.add(testUser, id, permission);
        
        const thePermission = await db.RPTs.get(testUser, "testId");
        expect(thePermission).toMatchObject(permission);
        
        let allPermissions = await db.RPTs.list(testUser);
        expect(allPermissions).toMatchObject({[id]: permission});

        await db.RPTs.del(testUser, "testId");
        
        allPermissions = await db.RPTs.list(testUser);
        expect(allPermissions).toMatchObject({});
    });
});


describe("policies", () => {
    it("returns an empty object if no policies has been registered.", async () => {
        expect.assertions(1);
        const allPolicies = await db.Policies.list("id");
        expect(allPolicies).toMatchObject({});
    });

    it("adds, reads, and deletes a policy.", async () => {
        expect.assertions(3);
        const testUser = {id: "testUserId"};
        const policy = {user: testUser};
        const id = "testId";
        await db.Policies.add(testUser, id, policy);
        
        const thePolicy = await db.Policies.get(testUser, "testId");
        expect(thePolicy).toMatchObject(policy);
        
        let allPolicies = await db.Policies.list(testUser);
        expect(allPolicies).toMatchObject({[id]: policy});

        await db.Policies.del(testUser, "testId");
        
        allPolicies = await db.Policies.list(testUser);
        expect(allPolicies).toMatchObject({});
    });
});
