if (process.env.NODE_ENV !== "ci") {
  process.env.NODE_ENV = "test";
}

async function setUp() {}

module.exports = setUp;
