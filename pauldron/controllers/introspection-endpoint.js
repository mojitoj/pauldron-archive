const _ = require("lodash");
const APIAuthorization = require("../lib/api-authorization");
const GenericErrorHandler = require("./error-handler");
const TimeStampedPermission = require("../model/TimeStampedPermission");

const logger = require ("../lib/logger");
const db = require("../lib/db");


async function introspect(req, res, next) {
  try {
      const user = APIAuthorization.validate(req, ["INTR:R"]);
      validateIntrospectionRequestParams(req.body);
      const token = req.body.token;
      const permission = await db.RPTs.get(user, token);
      validatePermission(permission);

      const introspectionResponseObject = {
        ...permission,
        active: true
      };
      delete introspectionResponseObject.id;
      res.status(200).send(introspectionResponseObject);
  } catch (e) {
    if (e.error && (e.error === "invalid_rpt" || e.error ==="expired_rpt")) {
      logger.verbose(`Introspecting RPT: ${e.error}`);
      res.status(200).send({active: false});
    } else {
      GenericErrorHandler.handle(e, res, req);
    }
  }
}

function validateIntrospectionRequestParams(object) {
  if (!object || !object.token) {
    throw {
      error: "bad_request",
      message: "Expecting a token."
    }
  }
}

function validatePermission(permission) {
  if (!permission) {
    throw {
      error: "invalid_rpt"
    }
  } else if (TimeStampedPermission.isExpired(permission)) {
    throw {
      error: "expired_rpt"
    }
  }
}

module.exports = {
  introspect
};
